// Deterministic fixed-timestep physics simulation
// Used both in the live game (Game scene) and for ghost replay.
// All values in pixels and seconds.

class PhysicsBody {
  constructor(x, y, w, h) {
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.onWall = 0; // -1 left, 0 none, 1 right
    this.dashAvailable = true;
    this.dashTimer = 0;
    this.dashVx = 0;
    this.dashVy = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.wallSliding = false;
    this.dead = false;
    this.finished = false;
  }
}

class PhysicsSim {
  constructor(tilemap) {
    this.tilemap = tilemap;
    this.FIXED_DT = 1 / 60;
    this.accumulator = 0;
  }

  // dt in seconds, input = { left, right, jump, jumpHeld, dash, slide }
  // Returns array of events: 'death', 'finish', 'near_miss'
  step(body, input, dt) {
    this.accumulator += dt;
    const events = [];
    while (this.accumulator >= this.FIXED_DT) {
      this.accumulator -= this.FIXED_DT;
      const e = this._tick(body, input);
      events.push(...e);
    }
    return events;
  }

  _tick(body, input) {
    if (body.dead || body.finished) return [];
    const P = PHYSICS;
    const dt = this.FIXED_DT;
    const events = [];

    // Timers
    if (body.coyoteTimer > 0) body.coyoteTimer -= dt;
    if (body.jumpBufferTimer > 0) body.jumpBufferTimer -= dt;
    if (body.dashTimer > 0) body.dashTimer -= dt;

    // Track coyote time
    const wasOnGround = body.onGround;
    if (wasOnGround) body.coyoteTimer = P.COYOTE_TIME;

    // Jump buffer
    if (input.jump) body.jumpBufferTimer = P.JUMP_BUFFER;

    // Dashing
    if (body.dashTimer > 0) {
      body.vx = body.dashVx;
      body.vy = body.dashVy;
    } else {
      // Horizontal movement
      const targetVx = input.right ? P.MAX_RUN_SPEED : input.left ? -P.MAX_RUN_SPEED : 0;
      const accel = body.onGround ? P.RUN_ACCEL : P.AIR_ACCEL;
      const friction = P.RUN_FRICTION;

      if (targetVx !== 0) {
        body.vx = _moveToward(body.vx, targetVx, accel * dt);
      } else {
        body.vx = _moveToward(body.vx, 0, friction * dt);
      }

      // Gravity
      body.vy += P.GRAVITY * dt;

      // Wall slide
      body.wallSliding = false;
      if (body.onWall !== 0 && !body.onGround && body.vy > 0) {
        const holdingWall = (body.onWall === -1 && input.left) || (body.onWall === 1 && input.right);
        if (holdingWall) {
          body.wallSliding = true;
          body.vy = Math.min(body.vy, P.WALL_SLIDE_MAX);
        }
      }

      // Terminal velocity
      body.vy = Math.min(body.vy, P.TERMINAL_FALL);

      // Jump
      const canJump = (body.onGround || body.coyoteTimer > 0) && body.jumpBufferTimer > 0;
      const canWallJump = body.onWall !== 0 && !body.onGround && body.jumpBufferTimer > 0;

      if (canJump) {
        body.vy = P.JUMP_VELOCITY;
        body.jumpBufferTimer = 0;
        body.coyoteTimer = 0;
      } else if (canWallJump) {
        body.vy = P.WALL_JUMP_Y;
        body.vx = P.WALL_JUMP_X * -body.onWall;
        body.jumpBufferTimer = 0;
        body.dashAvailable = true;
      }

      // Jump cut (variable jump height)
      if (!input.jumpHeld && body.vy < 0) {
        body.vy *= Math.pow(P.JUMP_CUT, dt * 60);
      }

      // Dash trigger
      if (input.dash && body.dashAvailable) {
        body.dashAvailable = false;
        body.dashTimer = P.DASH_DURATION;
        const dx = input.right ? 1 : input.left ? -1 : (body.facing || 1);
        const dy = 0;
        body.dashVx = dx * P.DASH_SPEED;
        body.dashVy = body.vy < 0 ? body.vy * 0.3 : 0;
        body.vx = body.dashVx;
        body.vy = body.dashVy;
      }
    }

    // Move + collide
    const result = this._moveAndCollide(body);
    if (result.hitSpike || result.hitSaw || result.hitCrusher) {
      events.push('death');
      body.dead = true;
    }
    if (result.hitFlag) {
      events.push('finish');
      body.finished = true;
    }
    if (result.nearMiss) events.push('near_miss');

    // Refresh dash on ground/wall
    if (body.onGround || body.onWall !== 0) body.dashAvailable = true;

    return events;
  }

  _moveAndCollide(body) {
    const result = { hitSpike: false, hitSaw: false, hitCrusher: false, hitFlag: false, nearMiss: false };

    // Move X then Y separately (classic platformer approach)
    body.x += body.vx * this.FIXED_DT;
    this._resolveAxis(body, 'x', result);

    body.y += body.vy * this.FIXED_DT;
    body.onGround = false;
    body.onWall = 0;
    this._resolveAxis(body, 'y', result);

    return result;
  }

  _resolveAxis(body, axis, result) {
    const T = TILE_SIZE;
    const left = Math.floor(body.x / T);
    const right = Math.floor((body.x + body.w - 1) / T);
    const top = Math.floor(body.y / T);
    const bottom = Math.floor((body.y + body.h - 1) / T);

    for (let tx = left; tx <= right; tx++) {
      for (let ty = top; ty <= bottom; ty++) {
        const tile = this.tilemap.get(tx, ty);
        if (!tile) continue;

        if (tile.type === 'spike' || tile.type === 'saw') {
          // Near miss detection: within 6px but not overlapping in Y
          result.hitSpike = true;
          continue;
        }
        if (tile.type === 'flag') { result.hitFlag = true; continue; }

        if (!this._isSolid(tile.type)) continue;

        const tx0 = tx * T, ty0 = ty * T;
        const tx1 = tx0 + T, ty1 = ty0 + T;

        if (axis === 'x') {
          if (body.vx > 0 && body.x + body.w > tx0 && body.x < tx1) {
            body.x = tx0 - body.w;
            body.vx = 0;
            body.onWall = 1;
          } else if (body.vx < 0 && body.x < tx1 && body.x + body.w > tx0) {
            body.x = tx1;
            body.vx = 0;
            body.onWall = -1;
          }
        } else {
          if (body.vy > 0 && body.y + body.h > ty0 && body.y < ty1) {
            body.y = ty0 - body.h;
            body.vy = 0;
            body.onGround = true;
          } else if (body.vy < 0 && body.y < ty1 && body.y + body.h > ty0) {
            // Corner correction
            const P = PHYSICS;
            const overlapLeft = (body.x + body.w) - tx0;
            const overlapRight = tx1 - body.x;
            if (Math.min(overlapLeft, overlapRight) <= P.CORNER_CORRECTION) {
              if (overlapLeft < overlapRight) body.x -= overlapLeft;
              else body.x += overlapRight;
            } else {
              body.y = ty1;
              body.vy = 0;
            }
          }
        }
      }
    }
  }

  _isSolid(type) {
    return type === 'ground' || type === 'wall' || type === 'platform' || type === 'crusher';
  }
}

function _moveToward(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}
