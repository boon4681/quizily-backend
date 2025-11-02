import PQueue from 'p-queue';

export const queue = new PQueue({ intervalCap: 7, interval: 60000 });