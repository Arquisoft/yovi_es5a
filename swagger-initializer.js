window.onload = function() {
  window.ui = SwaggerUIBundle({
    urls: [
      { url: "/openapi-users.yaml", name: "Users API" },
      { url: "/openapi-gamey.yaml", name: "GameY Bot API" }
    ],
    "urls.primaryName": "Users API",
    dom_id: '#swagger-ui',
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    layout: "StandaloneLayout"
  });
};