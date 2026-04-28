package io.gatling.demo;

import java.time.Duration;
import java.util.*;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;
import io.gatling.javaapi.jdbc.*;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;
import static io.gatling.javaapi.jdbc.JdbcDsl.*;

public class MyGatlingSimulation extends Simulation {
	
  private FeederBuilder<?> csvFeeder = 
  csv("io/gatling/demo/simulation/usuarios.csv").circular();

  private HttpProtocolBuilder httpProtocol = http
    .baseUrl("http://158.158.8.82:3000")
    .inferHtmlResources(AllowList(), DenyList(".*\\.js", ".*\\.css", ".*\\.gif", ".*\\.jpeg", ".*\\.jpg", ".*\\.ico", ".*\\.woff", ".*\\.woff2", ".*\\.(t|o)tf", ".*\\.png", ".*\\.svg", ".*detectportal\\.firefox\\.com.*"))
    .acceptHeader("*/*")
    .acceptEncodingHeader("gzip, deflate")
    .acceptLanguageHeader("es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7")
    .originHeader("http://158.158.8.82")
    .userAgentHeader("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0");
  
  // 1. Para peticiones OPTIONS (CORS Preflight)
  private Map<CharSequence, String> headers_preflight = Map.ofEntries(
    Map.entry("Access-Control-Request-Headers", "content-type,authorization"),
    Map.entry("Access-Control-Request-Method", "POST")
  );

  // 2. Para peticiones JSON públicas (Login, Registro)
  private Map<CharSequence, String> headers_json = Map.of(
    "Content-Type", "application/json"
  );

  // 3. Para peticiones JSON que requieren Token (Finalizar partida, Logout)
  private Map<CharSequence, String> headers_json_auth = Map.of(
    "Content-Type", "application/json",
    "Authorization", "Bearer #{miAccessToken}"
  );

  //4. Para peticiones GET que requieren Token (Check, Leaderboard, History)
  private Map<CharSequence, String> headers_auth = Map.of(
    "Authorization", "Bearer #{miAccessToken}"
  );
  
  private String uri1 = "158.158.8.82";

  private ScenarioBuilder scn = scenario("Simulation")
	.feed(csvFeeder)
    .exec(
      http("request_0")
        .options("/auth/register")
        .headers(headers_preflight),
      http("request_1")
        .post("/auth/register")
        .headers(headers_json)
        .body(ElFileBody("io/gatling/demo/simulation/0001_request.json")).asJson(),
      pause(3),
      http("request_2")
        .options("/auth/login")
        .headers(headers_preflight),
      http("request_3")
        .post("/auth/login")
        .headers(headers_json)
        .body(ElFileBody("io/gatling/demo/simulation/0003_request.json")).asJson()
        .check(
            status().is(200),
            jsonPath("$.accessToken").saveAs("miAccessToken"),
            jsonPath("$.refreshToken").saveAs("miRefreshToken")
        ),
      pause(10),
      http("request_4")
        .options("/auth/check")
        .headers(headers_preflight),
      http("request_5")
        .get("/auth/check")
        .headers(headers_auth),
      pause(2),
      http("request_6")
        .options("http://" + uri1 + ":4000/game/play/")
        .headers(headers_preflight),
      http("request_7")
        .post("http://" + uri1 + ":4000/game/play/")
        .headers(headers_json_auth)
        .body(ElFileBody("io/gatling/demo/simulation/0007_request.json")).asJson(),
      http("request_8")
        .options("http://" + uri1 + ":4000/game/play/")
        .headers(headers_preflight),
      http("request_9")
        .post("http://" + uri1 + ":4000/game/play/")
        .headers(headers_json_auth)
        .body(ElFileBody("io/gatling/demo/simulation/0009_request.json")).asJson(),
	  http("request_10")
        .options("http://" + uri1 + ":4000/game/play/")
        .headers(headers_preflight),
      http("request_11")
        .post("http://" + uri1 + ":4000/game/play/")
        .headers(headers_json_auth)
        .body(ElFileBody("io/gatling/demo/simulation/0011_request.json")).asJson(),
	  http("request_12")
        .options("http://" + uri1 + ":4000/game/play/")
        .headers(headers_preflight),
      http("request_13")
        .post("http://" + uri1 + ":4000/game/play/")
        .headers(headers_json_auth)
        .body(ElFileBody("io/gatling/demo/simulation/0013_request.json")).asJson(),
	  http("request_14")
        .options("http://" + uri1 + ":4000/game/play/")
        .headers(headers_preflight),
      http("request_15")
        .post("http://" + uri1 + ":4000/game/play/")
        .headers(headers_json_auth)
        .body(ElFileBody("io/gatling/demo/simulation/0015_request.json")).asJson(),
	  http("request_16")
        .options("http://" + uri1 + ":4000/game/play/")
        .headers(headers_preflight),
      http("request_17")
        .post("http://" + uri1 + ":4000/game/play/")
        .headers(headers_json_auth)
        .body(ElFileBody("io/gatling/demo/simulation/0017_request.json")).asJson(),
	  http("request_18")
        .options("http://" + uri1 + ":4000/game/play/")
        .headers(headers_preflight),
      http("request_19")
        .post("http://" + uri1 + ":4000/game/play/")
        .headers(headers_json_auth)
        .body(ElFileBody("io/gatling/demo/simulation/0019_request.json")).asJson(),
	  http("request_20")
        .options("http://" + uri1 + ":4000/game/play/")
        .headers(headers_preflight),
      http("request_21")
        .post("http://" + uri1 + ":4000/game/play/")
        .headers(headers_json_auth)
        .body(ElFileBody("io/gatling/demo/simulation/0021_request.json")).asJson(),
	  http("request_22")
        .options("http://" + uri1 + ":4000/game/play/")
        .headers(headers_preflight),
      http("request_23")
        .post("http://" + uri1 + ":4000/game/play/")
        .headers(headers_json_auth)
        .body(ElFileBody("io/gatling/demo/simulation/0023_request.json")).asJson(),
	  http("request_24")
        .options("http://" + uri1 + ":4000/game/play/")
        .headers(headers_preflight),
      http("request_25")
        .post("http://" + uri1 + ":4000/game/play/")
        .headers(headers_json_auth)
        .body(ElFileBody("io/gatling/demo/simulation/0025_request.json")).asJson(),
	  http("request_26")
        .options("http://" + uri1 + ":4000/game/play/")
        .headers(headers_preflight),
      http("request_27")
        .post("http://" + uri1 + ":4000/game/play/")
        .headers(headers_json_auth)
        .body(ElFileBody("io/gatling/demo/simulation/0027_request.json")).asJson(),
	  http("request_28")
        .options("http://" + uri1 + ":4000/game/play/")
        .headers(headers_preflight),
      http("request_29")
        .post("http://" + uri1 + ":3000/finished-match/")
        .headers(headers_json_auth)
        .body(ElFileBody("io/gatling/demo/simulation/0029_request.json")).asJson(),
      pause(14),
      http("request_30")
        .get("/leaderboard?page=1&pageSize=25")
        .headers(headers_auth),
      pause(9),
      http("request_31")
        .get("/users/#{username}")
        .headers(headers_auth)
        .resources(
          http("request_32")
            .get("/users/${username}/centered-leaderboard?pageSize=25")
            .headers(headers_auth),
          http("request_33")
            .get("/users/#{username}/history?page=1&pageSize=25&botPage=1&botPageSize=25&pvpPage=1&pvpPageSize=25")
            .headers(headers_auth),
          http("request_34")
            .get("/users/#{username}/centered-leaderboard?page=1&pageSize=25")
            .headers(headers_auth)
        )
    );

  {
	setUp(
	  scn.injectOpen(rampUsers(15).during(30)) 
	).protocols(httpProtocol);
  }
}
