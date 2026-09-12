import Logger from './logger';

const log = new Logger('discord');

/** Send a message to the configured Discord webhook */
export async function sendDiscordNotification(
  message: string,
  title = 'Domain Locker',
): Promise<boolean> {
  const url = process.env['DISCORD_WEBHOOK_URL']?.trim();
  if (!url) {
    log.info('Discord notification skipped (missing config)');
    return false;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `**${title}**\n${message}` }),
    });
    if (!res.ok) {
      throw new Error(`Failed with status ${res.status}`);
    }
    log.info(`Discord sent: ${title} - ${message}`);
    return true;
  } catch (err) {
    log.error(`Discord failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
