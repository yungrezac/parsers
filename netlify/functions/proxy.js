// netlify/functions/proxy.js
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const url = event.queryStringParameters.url;
  if (!url) {
    return { statusCode: 400, body: 'Missing URL' };
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    });
    const data = await response.text();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: data,
    };
  } catch (error) {
    return { statusCode: 500, body: error.toString() };
  }
};
