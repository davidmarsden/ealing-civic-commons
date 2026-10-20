import { mailConfigured, sendMail } from '../lib/email-alerts.mjs';
import { ALERT_STATE_KEY, feedProblems, planAlert, readAlertInputs } from '../lib/feed-alerts.mjs';
import { store } from '../lib/feed-snapshot.mjs';

// Hourly check of the feed pipeline: emails FEED_ALERT_EMAIL (comma-separated)
// when the snapshot is stale or missing, the last ingest failed, or a source has
// been failing for more than 24 hours. Without recipients or mail configuration
// it only logs, and records nothing, so the first configured run reports
// everything that is open.
export async function runFeedHealthCheck({ blobs = store({ consistency: 'strong' }), send = sendMail, recipients = String(process.env.FEED_ALERT_EMAIL || '').split(',').map(value => value.trim()).filter(Boolean), canSend = mailConfigured(), now = Date.now() } = {}) {
  const { snapshot, lastRun, previous } = await readAlertInputs(blobs);
  const problems = feedProblems({ snapshot, lastRun, now });
  console.log(`Feed health: ${problems.length ? problems.map(problem => problem.key).join(', ') : 'no problems'}`);
  if (!recipients.length || !canSend) {
    if (problems.length) console.warn(`Feed health alert not sent: ${!recipients.length ? 'FEED_ALERT_EMAIL is not set' : 'email delivery is not configured'}`);
    return { problems, sent: false, reason: 'not-configured' };
  }
  const plan = planAlert(problems, previous, now);
  if (!plan.send) {
    await blobs.setJSON(ALERT_STATE_KEY, plan.nextState);
    return { problems, sent: false, reason: 'unchanged' };
  }
  // State is recorded only after every recipient was sent to, so a failed send is
  // retried on the next hourly run rather than lost.
  await Promise.all(recipients.map(to => send({ to, subject: plan.subject, text: plan.text })));
  await blobs.setJSON(ALERT_STATE_KEY, plan.nextState);
  return { problems, sent: true, subject: plan.subject };
}

export default async () => {
  try {
    await runFeedHealthCheck();
  } catch (error) {
    console.error('Feed health check failed', error);
  }
};

export const config = {
  schedule: '7 * * * *'
};
