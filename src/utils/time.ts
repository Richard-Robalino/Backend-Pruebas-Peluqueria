import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import isBetween from 'dayjs/plugin/isBetween.js';
dayjs.extend(utc as any);
dayjs.extend(isBetween as any);

export { dayjs };
