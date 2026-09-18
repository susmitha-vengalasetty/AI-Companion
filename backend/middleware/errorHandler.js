export const errorHandler = (err, req, res, next) => {
  console.error('[Error Middleware]', err.stack || err.message);

  const isQuota =
    err.status === 429 ||
    err.statusCode === 429 ||
    /resource_exhausted|embedding_rate_limited|quota.*exceeded|rate limit|toomanyrequests/i.test(err.message || '');

  const statusCode = isQuota ? 429 : (res.statusCode === 200 ? (err.statusCode || err.status || 500) : res.statusCode);

  res.status(statusCode).json({
    success: false,
    ...(isQuota ? { errorCode: 'GEMINI_QUOTA_EXCEEDED' } : {}),
    message: isQuota
      ? 'PDF processing is temporarily unavailable because the Gemini API quota/rate limit has been reached. Please try again after the quota resets.'
      : (err.message || 'Internal Server Error'),
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
