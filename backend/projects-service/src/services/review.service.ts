import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import {
  NotFoundError,
  BusinessRuleError,
  ConflictError,
} from '../utils/errors';
import { ProjectStatus } from '../generated/prisma';
import type {
  CreateReviewInput,
  RespondToReviewInput,
  ModerateReviewInput,
  GetReviewsQuery,
} from '../schemas/review.schemas';

export class ReviewService {
  /**
   * Submit a review for completed project
   */
  async createReview(
    projectId: string,
    userId: string,
    input: CreateReviewInput
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { review: true },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.user_id !== userId) {
      throw new BusinessRuleError('You can only review your own projects');
    }

    // Can only review completed installations
    if (project.status !== ProjectStatus.installation_completed && project.status !== ProjectStatus.completed) {
      throw new BusinessRuleError('You can only review completed installations');
    }

    if (project.review) {
      throw new ConflictError('A review has already been submitted for this project');
    }

    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.projectReview.create({
        data: {
          project_id: projectId,
          user_id: userId,
          contractor_id: project.contractor_id,
          rating: input.rating,
          review_text: input.review_text,
          review_title: input.review_title,
          quality_rating: input.quality_rating,
          communication_rating: input.communication_rating,
          timeliness_rating: input.timeliness_rating,
          professionalism_rating: input.professionalism_rating,
          value_rating: input.value_rating,
          would_recommend: input.would_recommend,
          photo_urls: input.photo_urls as any,
          has_photos: input.photo_urls && input.photo_urls.length > 0,
        },
      });

      // Update project status to completed
      await tx.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.completed,
          completed_at: new Date(),
        },
      });

      // Add timeline entry
      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
          event_type: 'review_submitted',
          title: 'Review Submitted',
          description: `User submitted a ${input.rating}-star review`,
          created_by_id: userId,
          created_by_role: 'user',
          metadata: {
            rating: input.rating,
            would_recommend: input.would_recommend,
          },
        },
      });

      // Also create project completion timeline
      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
          event_type: 'project_completed',
          title: 'Project Completed',
          description: 'Project has been fully completed',
          created_by_role: 'system',
        },
      });

      return review;
    });

    logger.info('Review created', {
      projectId,
      userId,
      rating: input.rating,
      contractorId: project.contractor_id,
    });

    // TODO: Update contractor's average rating in contractor-service
    // await updateContractorRating(project.contractor_id);

    return result;
  }

  /**
   * Get review by project ID
   */
  async getReviewByProjectId(projectId: string) {
    const review = await prisma.projectReview.findUnique({
      where: { project_id: projectId },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    return review;
  }

  /**
   * Get contractor's reviews
   */
  async getContractorReviews(contractorId: string, query: GetReviewsQuery) {
    const { page, limit, min_rating, max_rating, is_visible, sort_by, sort_order } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      contractor_id: contractorId,
    };

    if (is_visible !== undefined) {
      where.is_visible = is_visible;
    }

    if (min_rating) {
      where.rating = { ...where.rating, gte: min_rating };
    }

    if (max_rating) {
      where.rating = { ...where.rating, lte: max_rating };
    }

    const [reviews, total] = await Promise.all([
      prisma.projectReview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
      }),
      prisma.projectReview.count({ where }),
    ]);

    // Calculate average rating
    const avgRating = await prisma.projectReview.aggregate({
      where: { contractor_id: contractorId, is_visible: true },
      _avg: {
        rating: true,
      },
      _count: true,
    });

    logger.info('Contractor reviews retrieved', {
      contractorId,
      count: reviews.length,
      total,
      avgRating: avgRating._avg.rating,
    });

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
      stats: {
        average_rating: avgRating._avg.rating ? Number(avgRating._avg.rating.toFixed(1)) : 0,
        total_reviews: avgRating._count,
      },
    };
  }

  /**
   * Get all reviews (admin)
   */
  async getAllReviews(query: GetReviewsQuery) {
    const { page, limit, contractor_id, min_rating, max_rating, is_visible, is_flagged, sort_by, sort_order } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (contractor_id) {
      where.contractor_id = contractor_id;
    }

    if (is_visible !== undefined) {
      where.is_visible = is_visible;
    }

    if (is_flagged) {
      where.is_flagged = true;
    }

    if (min_rating) {
      where.rating = { ...where.rating, gte: min_rating };
    }

    if (max_rating) {
      where.rating = { ...where.rating, lte: max_rating };
    }

    const [reviews, total] = await Promise.all([
      prisma.projectReview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
      }),
      prisma.projectReview.count({ where }),
    ]);

    logger.info('All reviews retrieved (admin)', {
      count: reviews.length,
      total,
      page,
    });

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Contractor responds to review
   */
  async respondToReview(
    projectId: string,
    contractorId: string,
    input: RespondToReviewInput
  ) {
    const review = await prisma.projectReview.findUnique({
      where: { project_id: projectId },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    if (review.contractor_id !== contractorId) {
      throw new BusinessRuleError('You can only respond to reviews for your own projects');
    }

    if (review.contractor_response) {
      throw new ConflictError('You have already responded to this review');
    }

    const updatedReview = await prisma.projectReview.update({
      where: { id: review.id },
      data: {
        contractor_response: input.contractor_response,
        contractor_responded_at: new Date(),
      },
    });

    logger.info('Contractor responded to review', {
      reviewId: review.id,
      contractorId,
      projectId,
    });

    return updatedReview;
  }

  /**
   * Moderate review (admin)
   */
  async moderateReview(
    reviewId: string,
    adminId: string,
    input: ModerateReviewInput
  ) {
    const review = await prisma.projectReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    const updatedReview = await prisma.projectReview.update({
      where: { id: reviewId },
      data: {
        is_visible: input.is_visible,
        is_flagged: input.is_flagged,
        flag_reason: input.flag_reason,
        moderated_by: adminId,
        moderated_at: new Date(),
      },
    });

    logger.info('Review moderated', {
      reviewId,
      adminId,
      is_visible: input.is_visible,
      is_flagged: input.is_flagged,
    });

    return updatedReview;
  }
}

export const reviewService = new ReviewService();
