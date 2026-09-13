import { env } from 'cloudflare:workers';
export function store(){if(!env.DB)throw new Error('联机服务暂时不可用，请稍后重试');return env.DB.withSession('first-primary');}
