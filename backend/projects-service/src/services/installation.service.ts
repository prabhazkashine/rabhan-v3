import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import {
  NotFoundError,
  BusinessRuleError,
  ValidationError,
} from '../utils/errors';
import { ProjectStatus, InstallationStatus } from '../generated/prisma';
import { generateOTP, getOTPExpiry, isOTPValid, sendOTPViaSMS } from '../utils/otp';
import { getPaymentDetailsViaPaymentService } from '../utils/payment-client';
import type {
  ScheduleInstallationInput,
  StartInstallationInput,
  CompleteInstallationInput,
  VerifyCompletionInput,
  QualityCheckInput,
  UploadInstallationDocumentInput,
} from '../schemas/installation.schemas';

export class InstallationService {
  /**
   * Schedule installation (contractor or user)
   */
  async scheduleInstallation(
    projectId: string,
    userId: string,
    userRole: string,
    input: ScheduleInstallationInput
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { installation: true },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Fetch payment details from payment service
    const payment = await getPaymentDetailsViaPaymentService(projectId, userId, userRole);

    if (!payment) {
      throw new BusinessRuleError(
        'No payment method has been selected for this project. Please select a payment method (Single Pay or BNPL) before scheduling installation.'
      );
    }

    // For BNPL: Allow scheduling after downpayment (status: partially_paid or payment_processing)
    // For Single Payment: Only allow after full payment is completed
    if (payment.payment_method === 'bnpl') {
      // BNPL: Check if downpayment is received (partially_paid or payment_processing)
      if (
        payment.payment_status !== 'partially_paid' &&
        payment.payment_status !== 'completed' &&
        project.status !== ProjectStatus.installation_scheduled
      ) {
        throw new BusinessRuleError('Downpayment must be received before scheduling installation for BNPL');
      }
    } else {
      if (
        project.status !== ProjectStatus.payment_completed &&
        project.status !== ProjectStatus.installation_scheduled
      ) {
        throw new BusinessRuleError('Full payment must be completed before scheduling installation');
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let installation;

      if (project.installation) {
        installation = await tx.projectInstallation.update({
          where: { id: project.installation.id },
          data: {
            status: InstallationStatus.scheduled,
            scheduled_date: new Date(input.scheduled_date),
            scheduled_time_slot: input.scheduled_time_slot,
            estimated_duration_hours: input.estimated_duration_hours,
            team_lead_name: input.team_lead_name,
            team_lead_phone: input.team_lead_phone,
            installation_notes: input.installation_notes,
          },
        });
      } else {
        installation = await tx.projectInstallation.create({
          data: {
            project_id: projectId,
            status: InstallationStatus.scheduled,
            scheduled_date: new Date(input.scheduled_date),
            scheduled_time_slot: input.scheduled_time_slot,
            estimated_duration_hours: input.estimated_duration_hours,
            team_lead_name: input.team_lead_name,
            team_lead_phone: input.team_lead_phone,
            installation_notes: input.installation_notes,
          },
        });
      }

      await tx.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.installation_scheduled,
          actual_installation_date: new Date(input.scheduled_date),
        },
      });

      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
          event_type: 'installation_scheduled',
          title: 'Installation Scheduled',
          description: `Installation scheduled for ${new Date(input.scheduled_date).toLocaleDateString()}`,
          created_by_id: userId,
          created_by_role: 'contractor',
          metadata: {
            scheduled_date: input.scheduled_date,
            time_slot: input.scheduled_time_slot,
          },
        },
      });

      return installation;
    });

    logger.info('Installation scheduled', {
      projectId,
      scheduledDate: input.scheduled_date,
    });

    return result;
  }

  /**
   * Start installation (contractor)
   */
  async startInstallation(
    projectId: string,
    contractorId: string,
    input: StartInstallationInput
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { installation: true },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.contractor_id !== contractorId) {
      throw new BusinessRuleError('Only assigned contractor can start installation');
    }

    if (!project.installation) {
      throw new BusinessRuleError('Installation must be scheduled first');
    }

    if (project.installation.status === InstallationStatus.in_progress) {
      throw new BusinessRuleError('Installation has already been started');
    }

    const result = await prisma.$transaction(async (tx) => {
      const installation = await tx.projectInstallation.update({
        where: { id: project.installation!.id },
        data: {
          status: InstallationStatus.in_progress,
          started_at: new Date(),
          installation_team: input.installation_team,
          team_lead_name: input.team_lead_name || project.installation!.team_lead_name,
          team_lead_phone: input.team_lead_phone || project.installation!.team_lead_phone,
          installation_notes: input.installation_notes || project.installation!.installation_notes,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.installation_in_progress },
      });

      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
          event_type: 'installation_started',
          title: 'Installation Started',
          description: 'Contractor has started the installation work',
          created_by_id: contractorId,
          created_by_role: 'contractor',
        },
      });

      return installation;
    });

    logger.info('Installation started', {
      projectId,
      contractorId,
    });

    return result;
  }

  /**
   * Complete installation and send OTP (contractor)
   */
  async completeInstallation(
    projectId: string,
    contractorId: string,
    input: CompleteInstallationInput
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { installation: true },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.contractor_id !== contractorId) {
      throw new BusinessRuleError('Only assigned contractor can complete installation');
    }

    if (!project.installation) {
      throw new BusinessRuleError('Installation record not found');
    }

    if (project.installation.status !== InstallationStatus.in_progress) {
      throw new BusinessRuleError('Installation must be in progress to complete');
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = getOTPExpiry(10); // 10 minutes

    const mockUserPhone = '+966501234567';

    // Send OTP to user
    const otpSent = await sendOTPViaSMS(mockUserPhone, otp, projectId);

    if (!otpSent) {
      throw new BusinessRuleError('Failed to send verification OTP');
    }

    const result = await prisma.$transaction(async (tx) => {
      const installation = await tx.projectInstallation.update({
        where: { id: project.installation!.id },
        data: {
          status: InstallationStatus.awaiting_verification,
          completed_at: new Date(),
          actual_duration_hours: input.actual_duration_hours,
          equipment_installed: input.equipment_installed as any,
          warranty_info: input.warranty_info as any,
          contractor_notes: input.contractor_notes,
          issues_encountered: input.issues_encountered,
          otp_code: otp,
          otp_expires_at: otpExpiry,
          otp_attempts: 0,
        },
      });

      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
          event_type: 'installation_completed',
          title: 'Installation Completed',
          description: 'Contractor has completed installation. Awaiting user verification.',
          created_by_id: contractorId,
          created_by_role: 'contractor',
          metadata: {
            equipment_installed: input.equipment_installed,
            duration_hours: input.actual_duration_hours,
          },
        },
      });

      return installation;
    });

    logger.info('Installation completed, OTP sent', {
      projectId,
      contractorId,
      otpSent: true,
    });

    return {
      ...result,
      otp_code: undefined, 
      message: 'Installation marked as complete. Verification OTP sent to user.',
    };
  }

  /**
   * Verify installation completion with OTP (user)
   */
  async verifyCompletion(
    projectId: string,
    userId: string,
    input: VerifyCompletionInput
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { installation: true },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.user_id !== userId) {
      throw new BusinessRuleError('Only project owner can verify completion');
    }

    if (!project.installation) {
      throw new NotFoundError('Installation record not found');
    }

    if (project.installation.status !== InstallationStatus.awaiting_verification) {
      throw new BusinessRuleError('Installation is not awaiting verification');
    }

    if (project.installation.otp_attempts >= project.installation.max_otp_attempts) {
      throw new BusinessRuleError('Maximum OTP verification attempts exceeded');
    }

    if (!project.installation.otp_expires_at || !isOTPValid(project.installation.otp_expires_at)) {
      throw new BusinessRuleError('OTP has expired. Please request a new one.');
    }

    if (project.installation.otp_code !== input.otp) {
      await prisma.projectInstallation.update({
        where: { id: project.installation.id },
        data: {
          otp_attempts: { increment: 1 },
        },
      });

      const remainingAttempts = project.installation.max_otp_attempts - (project.installation.otp_attempts + 1);

      logger.warn('Invalid OTP attempt', {
        projectId,
        userId,
        remainingAttempts,
      });

      throw new ValidationError(`Invalid OTP. ${remainingAttempts} attempts remaining.`);
    }

    // OTP is correct - mark installation as verified
    const result = await prisma.$transaction(async (tx) => {
      const installation = await tx.projectInstallation.update({
        where: { id: project.installation!.id },
        data: {
          status: InstallationStatus.verified,
          verified_at: new Date(),
          otp_verified: true,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.installation_completed,
        },
      });

      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
          event_type: 'installation_verified',
          title: 'Installation Verified',
          description: 'User has verified the completed installation',
          created_by_id: userId,
          created_by_role: 'user',
        },
      });

      return installation;
    });

    logger.info('Installation verified successfully', {
      projectId,
      userId,
    });

    return result;
  }

  /**
   * Perform quality check (admin/inspector)
   */
  async performQualityCheck(
    projectId: string,
    adminId: string,
    input: QualityCheckInput
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { installation: true },
    });

    if (!project || !project.installation) {
      throw new NotFoundError('Project or installation not found');
    }

    const installation = await prisma.projectInstallation.update({
      where: { id: project.installation.id },
      data: {
        quality_check_passed: input.quality_check_passed,
        quality_check_notes: input.quality_check_notes,
        quality_checked_by: input.quality_checked_by || adminId,
        quality_checked_at: new Date(),
      },
    });

    logger.info('Quality check performed', {
      projectId,
      passed: input.quality_check_passed,
      adminId,
    });

    return installation;
  }

  /**
   * Upload installation document
   */
  async uploadDocument(
    projectId: string,
    uploaderId: string,
    uploaderRole: string,
    input: UploadInstallationDocumentInput
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const document = await prisma.projectDocument.create({
      data: {
        project_id: projectId,
        document_type: input.document_type,
        title: input.title,
        description: input.description,
        file_url: input.file_url,
        file_name: input.file_name,
        file_size: input.file_size,
        file_mime_type: input.file_mime_type,
        uploaded_by_id: uploaderId,
        uploaded_by_role: uploaderRole,
      },
    });

    logger.info('Installation document uploaded', {
      projectId,
      documentId: document.id,
      documentType: input.document_type,
      uploaderId,
    });

    return document;
  }

  /**
   * Get installation details
   */
  async getInstallation(projectId: string) {
    const installation = await prisma.projectInstallation.findUnique({
      where: { project_id: projectId },
    });

    if (!installation) {
      throw new NotFoundError('Installation record not found');
    }

    return {
      ...installation,
      otp_code: undefined,
    };
  }
}

export const installationService = new InstallationService();
