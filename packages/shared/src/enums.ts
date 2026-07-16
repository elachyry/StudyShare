import { z } from 'zod';

export const Role = {
  STUDENT: 'STUDENT',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const roleSchema = z.enum([Role.STUDENT, Role.MODERATOR, Role.ADMIN]);

/** Roles ordered by privilege for hierarchy checks. */
export const ROLE_RANK: Record<Role, number> = {
  STUDENT: 0,
  MODERATOR: 1,
  ADMIN: 2,
};

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
export const userStatusSchema = z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED]);

export const ResourceType = {
  LESSON: 'LESSON',
  SUMMARY: 'SUMMARY',
  EXERCISE: 'EXERCISE',
} as const;
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];
export const resourceTypeSchema = z.enum([
  ResourceType.LESSON,
  ResourceType.SUMMARY,
  ResourceType.EXERCISE,
]);

export const ResourceStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ResourceStatus = (typeof ResourceStatus)[keyof typeof ResourceStatus];
export const resourceStatusSchema = z.enum([
  ResourceStatus.PENDING,
  ResourceStatus.APPROVED,
  ResourceStatus.REJECTED,
]);

export const RequestStatus = {
  OPEN: 'OPEN',
  FULFILLED: 'FULFILLED',
  CLOSED: 'CLOSED',
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];
export const requestStatusSchema = z.enum([
  RequestStatus.OPEN,
  RequestStatus.FULFILLED,
  RequestStatus.CLOSED,
]);

export const EmailTokenType = {
  VERIFY_EMAIL: 'VERIFY_EMAIL',
  RESET_PASSWORD: 'RESET_PASSWORD',
} as const;
export type EmailTokenType = (typeof EmailTokenType)[keyof typeof EmailTokenType];

export const ReportTargetType = {
  RESOURCE: 'RESOURCE',
  COMMENT: 'COMMENT',
} as const;
export type ReportTargetType = (typeof ReportTargetType)[keyof typeof ReportTargetType];
export const reportTargetTypeSchema = z.enum([
  ReportTargetType.RESOURCE,
  ReportTargetType.COMMENT,
]);

export const ReportStatus = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];
export const reportStatusSchema = z.enum([
  ReportStatus.OPEN,
  ReportStatus.RESOLVED,
  ReportStatus.DISMISSED,
]);

export const NotificationType = {
  REQUEST_FULFILLED: 'REQUEST_FULFILLED',
  RESOURCE_APPROVED: 'RESOURCE_APPROVED',
  RESOURCE_REJECTED: 'RESOURCE_REJECTED',
  NEW_COMMENT: 'NEW_COMMENT',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
export const notificationTypeValues = [
  NotificationType.REQUEST_FULFILLED,
  NotificationType.RESOURCE_APPROVED,
  NotificationType.RESOURCE_REJECTED,
  NotificationType.NEW_COMMENT,
] as const;
export const notificationTypeSchema = z.enum(notificationTypeValues);
