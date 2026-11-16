import type { RiskLevel } from '../../domain/risk/riskScorer';
import type { AppErrorKind } from '../../shared/appError';
import { NO_DETAILS_FLAGGED } from '../review/reviewModel';
import {
  reporterErrorMessage,
  reporterErrorMessageAfterCloud,
} from '../review/reporterErrorMessages';

/** Calm copy for the approval step. Never includes report text; never promises anonymity. */

export const ACKNOWLEDGEMENT_LABEL =
  'I understand this text may still allow someone to recognize me.';

const RISK_EXPLANATIONS: Readonly<Record<RiskLevel, string>> = {
  NONE: NO_DETAILS_FLAGGED,
  LOW: 'A few small details remain. On their own they are unlikely to point to you.',
  MEDIUM: 'Some details you kept could help someone who knows you guess who wrote this.',
  HIGH: 'The details you kept could make it easy for someone who knows you to recognize you.',
};

/** What the residual risk means for the reporter, plus a note about kept direct identifiers. */
export function residualRiskExplanation(level: RiskLevel, keptDirectIdentifiers: number): string {
  const base = RISK_EXPLANATIONS[level];
  if (keptDirectIdentifiers === 0) return base;
  return `${base} You also kept a name, email, phone or ID as written.`;
}

/** Where the reporter goes to fix a refused approval. */
export type ApprovalFixTarget = 'review' | 'outbox';

export interface ApprovalErrorCopy {
  readonly message: string;
  readonly target: ApprovalFixTarget;
}

const APPROVAL_ERRORS: Partial<Record<AppErrorKind, ApprovalErrorCopy>> = {
  DirectIdentifierRemains: {
    message: 'A name, email, phone or ID is still undecided. Go back to review to decide it.',
    target: 'review',
  },
  EmptyReport: {
    message:
      'Your changes removed all of the text, so there is nothing to approve. Go back to review and undo a change.',
    target: 'review',
  },
  RiskNotAcknowledged: {
    message:
      'Some details you kept could still point to you. Tick the box to confirm you understand, then approve again.',
    target: 'outbox',
  },
};

/**
 * Approval refusals have their own copy; anything else uses the general message and review.
 * `cloud`: the text was checked in the cloud (with consent), so the fallback never claims
 * that nothing left this device.
 */
export function approvalErrorCopy(kind: AppErrorKind, cloud = false): ApprovalErrorCopy {
  const message = cloud ? reporterErrorMessageAfterCloud(kind) : reporterErrorMessage(kind);
  return APPROVAL_ERRORS[kind] ?? { message, target: 'review' };
}

/** The reassurance under a refused approval; true in both modes. */
export function approvalNotSentNote(cloud: boolean): string {
  return cloud
    ? 'Nothing has been sent to the organization.'
    : 'Nothing has been sent. Your text is still only in this tab.';
}
