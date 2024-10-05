import { it } from "../../../../helpers";
import { Auth, ContactChannels, backendContext, niceBackendFetch } from "../../../backend-helpers";

it("signs in with OTP, disable used for auth, then should not be able to sign in again", async ({ expect }) => {
  await Auth.Otp.signIn();
  const cc = await ContactChannels.getTheOnlyContactChannel();
  // disable used for auth on the contact channel
  const response1 = await niceBackendFetch(`/api/v1/contact-channels/me/${cc.id}`, {
    method: "PATCH",
    accessType: "server",
    body: {
      is_verified: false,
    },
  });
  expect(response1.status).toBe(200);

  // should not be able to sign in again
  const response2 = await niceBackendFetch("/api/v1/auth/otp/send-sign-in-code", {
    method: "POST",
    accessType: "client",
    body: {
      email: backendContext.value.mailbox.emailAddress,
      callback_url: "http://localhost:12345/some-callback-url",
    },
  });
  expect(response2).toMatchInlineSnapshot(`
    NiceResponse {
      "status": 400,
      "body": {
        "code": "USER_EMAIL_ALREADY_EXISTS",
        "error": "User already exists.",
      },
      "headers": Headers {
        "x-stack-known-error": "USER_EMAIL_ALREADY_EXISTS",
        <some fields may have been hidden>,
      },
    }
  `);
});

it("signs in with password first, then cannot sign in with otp anymore", async ({ expect }) => {
  await Auth.Password.signUpWithEmail({ password: "some-password" });

  const response2 = await niceBackendFetch("/api/v1/auth/otp/send-sign-in-code", {
    method: "POST",
    accessType: "client",
    body: {
      email: backendContext.value.mailbox.emailAddress,
      callback_url: "http://localhost:12345/some-callback-url",
    },
  });
  expect(response2).toMatchInlineSnapshot(`
    NiceResponse {
      "status": 400,
      "body": {
        "code": "USER_EMAIL_ALREADY_EXISTS",
        "error": "User already exists.",
      },
      "headers": Headers {
        "x-stack-known-error": "USER_EMAIL_ALREADY_EXISTS",
        <some fields may have been hidden>,
      },
    }
  `);
});


it("signs in with OTP first, then signs in with oauth should give an account with used_for_auth false", async ({ expect }) => {
  await Auth.Otp.signIn();
  const cc = await ContactChannels.getTheOnlyContactChannel();
  expect(cc.is_verified).toBe(true);
  expect(cc.used_for_auth).toBe(true);

  await Auth.OAuth.signIn();
  const cc2 = await ContactChannels.getTheOnlyContactChannel();
  expect(cc2.value).toBe(cc.value);
  expect(cc2.is_verified).toBe(false);
  expect(cc2.used_for_auth).toBe(false);
});

it("signs in with password first, then signs in with oauth should give an account with used_for_auth false", async ({ expect }) => {
  await Auth.Password.signUpWithEmail({ password: "some-password" });
  const cc = await ContactChannels.getTheOnlyContactChannel();
  expect(cc.is_verified).toBe(false);
  expect(cc.used_for_auth).toBe(true);

  await Auth.OAuth.signIn();
  const cc2 = await ContactChannels.getTheOnlyContactChannel();
  expect(cc2.value).toBe(cc.value);
  expect(cc2.is_verified).toBe(false);
  expect(cc2.used_for_auth).toBe(false);
});

it("signs in with oauth, mark is_verified as true, then sign in with otp should merge with the account", async ({ expect }) => {
  await Auth.OAuth.signIn();
  const cc = await ContactChannels.getTheOnlyContactChannel();
  await niceBackendFetch(`/api/v1/contact-channels/me/${cc.id}`, {
    method: "PATCH",
    accessType: "server",
    body: {
      is_verified: true,
    },
  });

  await Auth.Otp.signIn();
  const cc2 = await ContactChannels.getTheOnlyContactChannel();
  expect(cc2.user_id).toBeDefined();
  expect(cc2.user_id).toBe(cc.user_id);
});