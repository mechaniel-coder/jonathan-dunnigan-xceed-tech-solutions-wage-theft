const passport   = require('passport');
const { Strategy: DiscordStrategy } = require('passport-discord');

function setup(clientId) {
  const adminIds = (process.env.DASHBOARD_ADMIN_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  passport.use(new DiscordStrategy({
    clientID:     clientId,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL:  process.env.OAUTH_REDIRECT_URI || 'http://localhost:3002/auth/callback',
    scope:        ['identify'],
  }, (_at, _rt, profile, done) => {
    if (adminIds.length && !adminIds.includes(profile.id)) {
      return done(null, false, { message: 'not_authorized' });
    }
    return done(null, {
      id:       profile.id,
      username: profile.username,
      avatar:   profile.avatar,
    });
  }));

  passport.serializeUser((u, done)   => done(null, u));
  passport.deserializeUser((u, done) => done(null, u));
}

/**
 * Register a second Passport strategy ("discord-user") that allows any
 * Discord user — used for the /buy/* payment portal.
 * Must be called AFTER setup() so serializeUser/deserializeUser are already set.
 *
 * @param {string} clientId
 */
function setupUserStrategy(clientId) {
  // Don't register twice
  if (passport._strategies['discord-user']) return;

  passport.use('discord-user', new DiscordStrategy({
    clientID:     clientId,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL:  process.env.OAUTH_USER_REDIRECT_URI ||
                  process.env.OAUTH_REDIRECT_URI?.replace('/auth/callback', '/buy/auth/callback') ||
                  'http://localhost:3002/buy/auth/callback',
    scope:        ['identify'],
    passReqToCallback: false,
  }, (_at, _rt, profile, done) => {
    // Any Discord user is allowed here (no admin check)
    return done(null, {
      id:       profile.id,
      username: profile.username,
      avatar:   profile.avatar,
    });
  }));
}

module.exports = { setup, setupUserStrategy, passport };
