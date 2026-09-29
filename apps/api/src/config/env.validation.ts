import * as Joi from 'joi';

export const envValidation = Joi.object({
  // App
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  APP_NAME: Joi.string().default('Caffenet'),
  APP_URL: Joi.string().uri().default('http://localhost:3001'),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  // Deployment profile
  DEPLOYMENT_PROFILE: Joi.string().valid('shared', 'vps').default('shared'),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Cache
  CACHE_DRIVER: Joi.string().valid('file', 'redis').default('file'),
  REDIS_URL: Joi.string().uri().when('CACHE_DRIVER', {
    is: 'redis',
    then: Joi.required(),
  }),

  // Queue
  QUEUE_DRIVER: Joi.string().valid('database', 'redis').default('database'),
  QUEUE_REDIS_URL: Joi.string().uri().when('QUEUE_DRIVER', {
    is: 'redis',
    then: Joi.required(),
  }),
  WORKER_MAX_JOBS: Joi.number().default(50),
  WORKER_TIMEOUT_SECONDS: Joi.number().default(55),
  WORKER_QUEUE_NAME: Joi.string().default('caffenet-jobs'),

  // Storage
  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  STORAGE_LOCAL_PUBLIC_PATH: Joi.string().default('./storage/app/public'),
  STORAGE_LOCAL_PRIVATE_PATH: Joi.string().default('./storage/app/private'),
  STORAGE_S3_ENDPOINT: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
  }),
  STORAGE_S3_REGION: Joi.string().default('us-east-1'),
  STORAGE_S3_BUCKET: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
  }),
  STORAGE_S3_ACCESS_KEY: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
  }),
  STORAGE_S3_SECRET_KEY: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
  }),
  STORAGE_S3_FORCE_PATH_STYLE: Joi.boolean().default(true),
  STORAGE_S3_PUBLIC_BASE_URL: Joi.string(),

  // Auth
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),
  COOKIE_SECRET: Joi.string().min(32).required(),
  BCRYPT_COST: Joi.number().default(12),

  // Pusher
  PUSHER_APP_ID: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.allow(''),
  }),
  PUSHER_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.allow(''),
  }),
  PUSHER_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.allow(''),
  }),
  PUSHER_CLUSTER: Joi.string().default('mt1'),

  // ZarinPal
  ZARINPAL_MERCHANT_ID: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.allow(''),
  }),
  ZARINPAL_SANDBOX: Joi.boolean().default(true),
  ZARINPAL_CALLBACK_URL: Joi.string().uri().required(),
  // Zibal (Phase 6.4.4)
  ZIBAL_MERCHANT_ID: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.allow(''),
  }),
  ZIBAL_SANDBOX: Joi.boolean().default(true),
  PAYMENT_DEFAULT_GATEWAY: Joi.string().valid('zarinpal', 'zibal').default('zarinpal'),

  // iPanel SMS
  IPANEL_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.allow(''),
  }),
  IPANEL_SENDER: Joi.string().allow(''),
  IPANEL_OTP_PATTERN_CODE: Joi.string().allow(''),
  IPANEL_OTP_PARAM_NAME: Joi.string().default('code'),
  // SMS driver selector — controls which adapter SmsModule loads
  SMS_DRIVER: Joi.string().valid('ipanel', 'kavenegar', 'console').default('ipanel'),

  // VAPID
  VAPID_PUBLIC_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.allow(''),
  }),
  VAPID_PRIVATE_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.allow(''),
  }),
  VAPID_SUBJECT: Joi.string().allow(''),

  // Mail
  MAIL_HOST: Joi.string().allow(''),
  MAIL_PORT: Joi.number().default(587),
  MAIL_USER: Joi.string().allow(''),
  MAIL_PASS: Joi.string().allow(''),
  MAIL_FROM: Joi.string().allow(''),

  // CORS
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),

  // Logging
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  LOG_FILE_PATH: Joi.string().default('./storage/logs/api.log'),
  LOG_PRETTY: Joi.boolean().default(true),

  // File upload
  FILE_UPLOAD_MAX_SIZE: Joi.number().default(10_485_760),
  FILE_UPLOAD_ALLOWED_MIME: Joi.string().default('image/jpeg,image/png,image/webp,application/pdf'),
});
