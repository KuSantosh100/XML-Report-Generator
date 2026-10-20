const VALID_API_KEYS = new Set([
  process.env.API_KEY_CONNECTOR_INCOMING
]);

module.exports = function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['apiKey'];
  //console.log("Inside api Key Authentication .... API Key: "+apiKey)

  if (!apiKey || !VALID_API_KEYS.has(apiKey)) {
    return res.status(401).json({ message: 'Invalid or missing API key' });
  }
  next();
};
