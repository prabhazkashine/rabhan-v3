import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { projectService } from '../services/project.service';
import { paymentService } from '../services/payment.service';
import { installationService } from '../services/installation.service';
import { reviewService } from '../services/review.service';
import { logger } from '../utils/logger';

export class ProjectController {
  // ==================== PROJECT ROUTES ====================

  async createProject(req: AuthRequest, res: Response) {
    try {
      const authToken = req.headers.authorization;

      const project = await projectService.createProject(req.user!.id, req.body, authToken);

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: project,
      });
    } catch (error) {
      throw error;
    }
  }

  async getProject(req: AuthRequest, res: Response) {
    try {
      const project = await projectService.getProjectById(
        req.params.projectId,
        req.user!.id,
        req.user!.role
      );

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      throw error;
    }
  }

  async getUserProjects(req: AuthRequest, res: Response) {
    try {
      const result = await projectService.getUserProjects(req.user!.id, req.query as any);

      res.json({
        success: true,
        data: result.projects,
        pagination: result.pagination,
      });
    } catch (error) {
      throw error;
    }
  }

  async getContractorProjects(req: AuthRequest, res: Response) {
    try {
      const result = await projectService.getContractorProjects(req.user!.id, req.query as any);

      res.json({
        success: true,
        data: result.projects,
        pagination: result.pagination,
      });
    } catch (error) {
      throw error;
    }
  }

  async getAllProjects(req: AuthRequest, res: Response) {
    try {
      const result = await projectService.getAllProjects(req.query as any);

      res.json({
        success: true,
        data: result.projects,
        pagination: result.pagination,
      });
    } catch (error) {
      throw error;
    }
  }

  async updateProject(req: AuthRequest, res: Response) {
    try {
      const project = await projectService.updateProject(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Project updated successfully',
        data: project,
      });
    } catch (error) {
      throw error;
    }
  }

  async cancelProject(req: AuthRequest, res: Response) {
    try {
      const project = await projectService.cancelProject(
        req.params.projectId,
        req.user!.id,
        req.user!.role,
        req.body
      );

      res.json({
        success: true,
        message: 'Project cancelled successfully',
        data: project,
      });
    } catch (error) {
      throw error;
    }
  }

  async getProjectTimeline(req: AuthRequest, res: Response) {
    try {
      const timeline = await projectService.getProjectTimeline(req.params.projectId);

      res.json({
        success: true,
        data: timeline,
      });
    } catch (error) {
      throw error;
    }
  }

  // ==================== PAYMENT ROUTES ====================

  async selectPaymentMethod(req: AuthRequest, res: Response) {
    try {
      const authToken = req.headers.authorization;

      const payment = await paymentService.selectPaymentMethod(
        req.params.projectId,
        req.user!.id,
        req.body,
        authToken
      );

      res.status(201).json({
        success: true,
        message: 'Payment method selected successfully',
        data: payment,
      });
    } catch (error) {
      throw error;
    }
  }

  async processFullPayment(req: AuthRequest, res: Response) {
    try {
      const payment = await paymentService.processFullPayment(
        req.params.projectId,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Payment processed successfully',
        data: payment,
      });
    } catch (error) {
      throw error;
    }
  }

  async processDownpayment(req: AuthRequest, res: Response) {
    try {
      const payment = await paymentService.processDownpayment(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Downpayment processed successfully',
        data: payment,
      });
    } catch (error) {
      throw error;
    }
  }

  async payInstallment(req: AuthRequest, res: Response) {
    try {
      const installment = await paymentService.payInstallment(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Installment paid successfully',
        data: installment,
      });
    } catch (error) {
      throw error;
    }
  }

  async getInstallmentSchedule(req: AuthRequest, res: Response) {
    try {
      const installments = await paymentService.getInstallmentSchedule(
        req.params.projectId,
        req.user!.id
      );

      res.json({
        success: true,
        data: installments,
      });
    } catch (error) {
      throw error;
    }
  }

  async releasePaymentToContractor(req: AuthRequest, res: Response) {
    try {
      const payment = await paymentService.releasePaymentToContractor(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Payment released to contractor successfully',
        data: payment,
      });
    } catch (error) {
      throw error;
    }
  }

  // ==================== INSTALLATION ROUTES ====================

  async scheduleInstallation(req: AuthRequest, res: Response) {
    try {
      const installation = await installationService.scheduleInstallation(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.status(201).json({
        success: true,
        message: 'Installation scheduled successfully',
        data: installation,
      });
    } catch (error) {
      throw error;
    }
  }

  async startInstallation(req: AuthRequest, res: Response) {
    try {
      const installation = await installationService.startInstallation(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Installation started successfully',
        data: installation,
      });
    } catch (error) {
      throw error;
    }
  }

  async completeInstallation(req: AuthRequest, res: Response) {
    try {
      const result = await installationService.completeInstallation(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  async verifyCompletion(req: AuthRequest, res: Response) {
    try {
      const installation = await installationService.verifyCompletion(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Installation verified successfully',
        data: installation,
      });
    } catch (error) {
      throw error;
    }
  }

  async performQualityCheck(req: AuthRequest, res: Response) {
    try {
      const installation = await installationService.performQualityCheck(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Quality check completed',
        data: installation,
      });
    } catch (error) {
      throw error;
    }
  }

  async uploadInstallationDocument(req: AuthRequest, res: Response) {
    try {
      const document = await installationService.uploadDocument(
        req.params.projectId,
        req.user!.id,
        req.user!.role,
        req.body
      );

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: document,
      });
    } catch (error) {
      throw error;
    }
  }

  async getInstallation(req: AuthRequest, res: Response) {
    try {
      const installation = await installationService.getInstallation(req.params.projectId);

      res.json({
        success: true,
        data: installation,
      });
    } catch (error) {
      throw error;
    }
  }

  // ==================== REVIEW ROUTES ====================

  async createReview(req: AuthRequest, res: Response) {
    try {
      const review = await reviewService.createReview(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.status(201).json({
        success: true,
        message: 'Review submitted successfully',
        data: review,
      });
    } catch (error) {
      throw error;
    }
  }

  async getReview(req: AuthRequest, res: Response) {
    try {
      const review = await reviewService.getReviewByProjectId(req.params.projectId);

      res.json({
        success: true,
        data: review,
      });
    } catch (error) {
      throw error;
    }
  }

  async getContractorReviews(req: AuthRequest, res: Response) {
    try {
      const result = await reviewService.getContractorReviews(
        req.params.contractorId,
        req.query as any
      );

      res.json({
        success: true,
        data: result.reviews,
        pagination: result.pagination,
        stats: result.stats,
      });
    } catch (error) {
      throw error;
    }
  }

  async getAllReviews(req: AuthRequest, res: Response) {
    try {
      const result = await reviewService.getAllReviews(req.query as any);

      res.json({
        success: true,
        data: result.reviews,
        pagination: result.pagination,
      });
    } catch (error) {
      throw error;
    }
  }

  async respondToReview(req: AuthRequest, res: Response) {
    try {
      const review = await reviewService.respondToReview(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Response added to review',
        data: review,
      });
    } catch (error) {
      throw error;
    }
  }

  async moderateReview(req: AuthRequest, res: Response) {
    try {
      const review = await reviewService.moderateReview(
        req.params.reviewId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Review moderated successfully',
        data: review,
      });
    } catch (error) {
      throw error;
    }
  }
}

export const projectController = new ProjectController();
