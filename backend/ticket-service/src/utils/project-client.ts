import axios from 'axios';
import { logger } from './logger';

const PROJECTS_SERVICE_URL = process.env.PROJECTS_SERVICE_URL || 'http://localhost:3008';

export interface ProjectData {
  id: string;
  user_id: string;
  contractor_id: string;
  status: string;
  total_amount: number;
  system_size_kwp: number | null;
  project_name: string | null;
  description: string | null;
  property_address: string | null;
  created_at: Date;
  completed_at: Date | null;
}

interface ProjectResponse {
  success: boolean;
  message: string;
  data: any;
}

/**
 * Fetch project details from the Projects Service
 * Requires authentication token to verify user access
 */
export async function getProjectById(projectId: string, authToken: string): Promise<ProjectData | null> {
  try {
    logger.info('Fetching project from Projects Service', { project_id: projectId });

    const response = await axios.get<ProjectResponse>(`${PROJECTS_SERVICE_URL}/api/projects/${projectId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      validateStatus: (status) => status >= 200 && status < 500,
    });

    if (response.status === 404) {
      logger.warn('Project not found in Projects Service', { project_id: projectId });
      return null;
    }

    if (response.status === 401) {
      logger.error('Unauthorized to access project', { project_id: projectId });
      return null;
    }

    if (response.status !== 200 || !response.data.success) {
      logger.error('Failed to fetch project from Projects Service', {
        project_id: projectId,
        status: response.status,
        message: response.data?.message || 'Unknown error'
      });
      return null;
    }

    const project = response.data.data;

    logger.info('Project fetched successfully', {
      project_id: projectId,
      contractor_id: project.contractor_id,
      status: project.status
    });

    return {
      id: project.id,
      user_id: project.user_id,
      contractor_id: project.contractor_id,
      status: project.status,
      total_amount: Number(project.total_amount),
      system_size_kwp: project.system_size_kwp ? Number(project.system_size_kwp) : null,
      project_name: project.project_name,
      description: project.description,
      property_address: project.property_address,
      created_at: new Date(project.created_at),
      completed_at: project.completed_at ? new Date(project.completed_at) : null,
    };
  } catch (error) {
    logger.error('Error fetching project from Projects Service:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      project_id: projectId
    });
    throw error;
  }
}

/**
 * Verify that the project is completed (required for creating support tickets)
 * Tickets can only be created for projects with status:
 * - installation_completed
 * - completed
 */
export function isProjectCompleted(project: ProjectData): boolean {
  const allowedStatuses = ['installation_completed', 'completed'];
  return allowedStatuses.includes(project.status);
}

/**
 * Verify that the user owns this project
 */
export function isUserProjectOwner(project: ProjectData, userId: string): boolean {
  return project.user_id === userId;
}
