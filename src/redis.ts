import 'dotenv/config';
import { createClient } from 'redis';

export const redis = createClient({
  url: process.env.REDIS_URL!,
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        return new Error('Redis connection failed');
      }
      return Math.min(retries * 50, 500);
    }
  }
});

redis.on('error', (err) => console.error('Redis error:', err));

await redis.connect();