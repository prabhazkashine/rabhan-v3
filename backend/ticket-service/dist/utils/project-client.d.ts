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
/**
 * Fetch project details from the Projects Service
 * Requires authentication token to verify user access
 */
export declare function getProjectById(projectId: string, authToken: string): Promise<ProjectData | null>;
/**
 * Verify that the project is completed (required for creating support tickets)
 * Tickets can only be created for projects with status:
 * - installation_completed
 * - completed
 */
export declare function isProjectCompleted(project: ProjectData): boolean;
/**
 * Verify that the user owns this project
 */
export declare function isUserProjectOwner(project: ProjectData, userId: string): boolean;
