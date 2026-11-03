const DEPLOYED_SERVER_URL = 'https://comely-support.support-server.workers.dev';

export const SUPPORT_SERVER_URL = process.env.COMELY_SUPPORT_URL ?? DEPLOYED_SERVER_URL;
