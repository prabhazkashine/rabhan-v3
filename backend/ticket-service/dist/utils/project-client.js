"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectById = getProjectById;
exports.isProjectCompleted = isProjectCompleted;
exports.isUserProjectOwner = isUserProjectOwner;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("./logger");
const PROJECTS_SERVICE_URL = process.env.PROJECTS_SERVICE_URL || 'http://localhost:3008';
/**
 * Fetch project details from the Projects Service
 * Requires authentication token to verify user access
 */
async function getProjectById(projectId, authToken) {
    try {
        logger_1.logger.info('Fetching project from Projects Service', { project_id: projectId });
        const response = await axios_1.default.get(`${PROJECTS_SERVICE_URL}/api/projects/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            validateStatus: (status) => status >= 200 && status < 500,
        });
        if (response.status === 404) {
            logger_1.logger.warn('Project not found in Projects Service', { project_id: projectId });
            return null;
        }
        if (response.status === 401) {
            logger_1.logger.error('Unauthorized to access project', { project_id: projectId });
            return null;
        }
        if (response.status !== 200 || !response.data.success) {
            logger_1.logger.error('Failed to fetch project from Projects Service', {
                project_id: projectId,
                status: response.status,
                message: response.data?.message || 'Unknown error'
            });
            return null;
        }
        const project = response.data.data;
        logger_1.logger.info('Project fetched successfully', {
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
    }
    catch (error) {
        logger_1.logger.error('Error fetching project from Projects Service:', {
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
function isProjectCompleted(project) {
    const allowedStatuses = ['installation_completed', 'completed'];
    return allowedStatuses.includes(project.status);
}
/**
 * Verify that the user owns this project
 */
function isUserProjectOwner(project, userId) {
    return project.user_id === userId;
}
