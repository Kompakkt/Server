import { info } from 'src/logger';

export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 1000,
): Promise<T> => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }
      const delay = initialDelay * Math.pow(2, attempt - 1);
      info(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
};
