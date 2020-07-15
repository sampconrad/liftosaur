import CloudflareWorkerGlobalScope, { CloudflareWorkerKV } from "types-cloudflare-worker";
import { Router } from "./router";
import { UidFactory } from "./utils/generator";
import * as Cookie from "cookie";
import JWT from "jsonwebtoken";
import { Backup } from "./backup";
import { CollectionUtils } from "./utils/collection";

declare let kv_liftosaur_google_access_tokens: CloudflareWorkerKV;
declare let kv_liftosaur_google_ids: CloudflareWorkerKV;
declare let kv_liftosaur_users: CloudflareWorkerKV;
declare let kv_liftosaur_published_programs: CloudflareWorkerKV;
declare let kv_liftosaur_programs: CloudflareWorkerKV;

interface IOpenIdResponse {
  sub: string;
  email: string;
}

interface IUser {
  id: string;
  email: string;
}

declare let self: CloudflareWorkerGlobalScope;
declare let webpushrKey: string;
declare let webpushrAuthToken: string;
declare let apiKey: string;
declare let cookieSecret: string;

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

const allowedHosts = ["local.liftosaur.com:8080", "www.liftosaur.com"];

function getHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "http://example.com";
  const url = new URL(origin);
  let headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (allowedHosts.some((h) => h === url.host)) {
    headers = {
      ...headers,
      "access-control-allow-origin": `${url.protocol}//${url.host}`,
      "access-control-allow-credentials": "true",
      "access-control-expose-headers": "cookie, set-cookie",
    };
  }
  return headers;
}

async function timerHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  const response = await fetch("https://app.webpushr.com/api/v1/notification/send/sid", {
    method: "POST",
    headers: {
      webpushrKey: webpushrKey,
      webpushrAuthToken: webpushrAuthToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Timer",
      message: "Time to get another attempt",
      target_url: "https://www.liftosaur.com",
      expire_push: "5m",
      sid: url.searchParams.get("sid"),
    }),
  });

  const init = {
    headers: getHeaders(request),
    status: response.status,
  };
  const body = JSON.stringify({ status: response.ok ? "ok" : "error" });
  return new Response(body, init);
}

async function googleLoginHandler(request: Request): Promise<Response> {
  const token = (await request.json()).token;
  const response = await fetch(`https://openidconnect.googleapis.com/v1/userinfo?access_token=${token}`);
  const openIdJson: IOpenIdResponse = await response.json();
  await kv_liftosaur_google_access_tokens.put(token, openIdJson.sub);
  let userId = await kv_liftosaur_google_ids.get(openIdJson.sub);
  if (userId == null) {
    userId = UidFactory.generateUid(12);
    await kv_liftosaur_google_ids.put(openIdJson.sub, userId);
  }
  const storageStr = await kv_liftosaur_users.get(userId);
  let storage;
  if (storageStr == null) {
    storage = { email: openIdJson.email, id: userId };
    await kv_liftosaur_users.put(userId, JSON.stringify(storage));
  } else {
    storage = JSON.parse(storageStr);
  }
  const session = JWT.sign({ userId: userId }, cookieSecret);
  return new Response(JSON.stringify({ email: openIdJson.email, user_id: userId, storage: storage.storage }), {
    headers: {
      ...getHeaders(request),
      "set-cookie": Cookie.serialize("session", session, {
        httpOnly: true,
        domain: ".liftosaur.com",
        path: "/",
        expires: new Date(new Date().getFullYear() + 10, 0, 1),
      }),
    },
  });
}

async function signoutHandler(request: Request): Promise<Response> {
  return new Response(JSON.stringify({}), {
    headers: {
      ...getHeaders(request),
      "set-cookie": Cookie.serialize("session", "", {
        httpOnly: true,
        domain: ".liftosaur.com",
        path: "/",
        expires: new Date(1970, 0, 1),
      }),
    },
  });
}

async function getCurrentUser(request: Request): Promise<IUser | undefined> {
  const cookies = Cookie.parse(request.headers.get("cookie") || "");
  if (cookies.session != null && JWT.verify(cookies.session, cookieSecret)) {
    const session = JWT.decode(cookies.session) as Record<string, string>;
    const resultRaw = await kv_liftosaur_users.get(session.userId);
    if (resultRaw != null) {
      const result = JSON.parse(resultRaw);
      return { id: result.id, email: result.email };
    }
  }
  return undefined;
}

async function getStorageHandler(request: Request): Promise<Response> {
  const user = await getCurrentUser(request);
  if (user != null) {
    const resultRaw = await kv_liftosaur_users.get(user.id);
    if (resultRaw != null) {
      const result = JSON.parse(resultRaw);
      return new Response(JSON.stringify({ storage: result.storage, email: user.email, user_id: user.id }), {
        headers: getHeaders(request),
      });
    }
  }
  return new Response(JSON.stringify({}), { headers: getHeaders(request) });
}

async function saveStorageHandler(request: Request): Promise<Response> {
  const user = await getCurrentUser(request);
  if (user != null) {
    const storage = (await request.json()).storage;
    const payload = { storage, email: user.email, id: user.id };
    await kv_liftosaur_users.put(user.id, JSON.stringify(payload));
    return new Response(JSON.stringify({}), { headers: getHeaders(request) });
  } else {
    return new Response(JSON.stringify({}), { headers: getHeaders(request) });
  }
}

async function backupHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get("key") === apiKey) {
    let result = true;
    result = result && (await new Backup(kv_liftosaur_users, "kv_liftosaur_users").backup());
    result = result && (await new Backup(kv_liftosaur_google_ids, "kv_liftosaur_google_ids").backup());
    result = result && (await new Backup(kv_liftosaur_published_programs, "kv_liftosaur_published_programs").backup());
    result =
      result && (await new Backup(kv_liftosaur_google_access_tokens, "kv_liftosaur_google_access_tokens").backup());
    return new Response(result ? "ok" : "error");
  } else {
    return new Response("wrong_key", { status: 400 });
  }
}

async function publishProgramHandler(request: Request): Promise<Response> {
  const user = await getCurrentUser(request);
  if (user != null) {
    const program = (await request.json()).program;
    const payload = { program, id: user.id, timestamp: Date.now() };
    await kv_liftosaur_published_programs.put(program.id, JSON.stringify(payload));
    return new Response(JSON.stringify({ data: "ok" }), { headers: getHeaders(request) });
  } else {
    return new Response(JSON.stringify({}), { status: 401, headers: getHeaders(request) });
  }
}

async function getProgramsHandler(request: Request): Promise<Response> {
  const keys = (await kv_liftosaur_published_programs.list()).keys;
  console.log(keys);
  const groups = CollectionUtils.inGroupsOf(100, keys);
  let programs: unknown[] = [];
  for (const group of groups) {
    programs = programs.concat(
      await Promise.all(group.map((key) => kv_liftosaur_published_programs.get(key.name, "json")))
    );
  }
  return new Response(JSON.stringify({ programs }), { headers: getHeaders(request) });
}

async function handleRequest(request: Request): Promise<Response> {
  const r = new Router();
  r.post(".*timernotification", (req: Request) => timerHandler(req));
  r.post(".*/api/signin/google", (req: Request) => googleLoginHandler(req));
  r.post(".*/api/signout", (req: Request) => signoutHandler(req));
  r.post(".*/api/storage", (req: Request) => saveStorageHandler(req));
  r.get(".*/api/storage", (req: Request) => getStorageHandler(req));
  r.post(".*/api/backup", (req: Request) => backupHandler(req));
  r.post(".*/api/publishprogram", (req: Request) => publishProgramHandler(req));
  r.get(".*/api/programs", (req: Request) => getProgramsHandler(req));
  const resp = await r.route(request);
  return resp;
}
