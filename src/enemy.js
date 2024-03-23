import * as PIXI from 'pixi.js';

import { aStar } from './astar';
import { createEnemy } from './physics';
import { lerpColor } from './util';

const images = [];
const width = 60;
const height = 60;
const hitFadeDuration = 100;

export function init(app) {
    for (let i = 3; i < 10; i++) {
        const c = new PIXI.Container();

        const g = new PIXI.Graphics();
        // Draw an i sided polygon with equal length sides.
        g.beginFill(0xffffff);
        
        // Initialize an empty array for the points
        const points = [];

        // Calculate the radius of the circumcircle to ensure equal side lengths
        const radius = Math.min(width, height) / 2;

        // Center the polygon within the container
        const centerX = width / 2;
        const centerY = height / 2;

        for (let j = 0; j < i; j++) {
            const angle = 2 * Math.PI * j / i; // Angle for each vertex
            const x = centerX + radius * Math.cos(angle); // Calculate x based on center and radius
            const y = centerY + radius * Math.sin(angle); // Calculate y based on center and radius
            points.push(x, y);
        }

        g.drawPolygon(points);
        g.endFill();

        g.beginFill(0xff0000);
        g.drawCircle(radius*2 - 15, radius, 5);
        g.endFill();

        c.addChild(g);

        const t = PIXI.RenderTexture.create({ width, height });
        app.renderer.render(c, { renderTexture: t });

        images[i] = t;
    }
}

export class Enemy extends PIXI.Container {
    constructor(x, y) {
        super();

        this.x = x;
        this.y = y;

        this.sprite = new PIXI.Sprite(images[Math.floor(3 + Math.random() * 7)]);
        this.sprite.anchor.set(0.5);
        this.addChild(this.sprite);

        this.health = 2;
        this.speed = 1;
        this.hitFade = 0;

        this.setSize();

        this.body = createEnemy(1);
        this.body.setPosition(x, y);
        this.body.setSize(Math.max(this.width, this.height));
    }

    setSize() {
        // Scale with this.health=1 being 0.5 and
        // this.health=100 being 1.2.
        let scale = 0.3 + 0.15 * this.health;
        scale = Math.floor(scale * 10) / 10;
        this.sprite.scale.set(scale);
    }

    damage(amount) {
        this.health -= amount;
        this.hitFade = hitFadeDuration;
        this.setSize();

        if (this.health <= 0) {
            this.destroy();
        }
    }

    destroy(opts) {
        this.body.destroy();

        super.destroy(opts);
    }

    getTarget(game) {
        const gp = game.worldPositionToGridPosition(this.x, this.y);
        //const targets = simplifyPath(game.grid, aStar(game.grid, gp, { x: 25, y: 7 }));
        const targets = aStar(game.grid, gp, { x: 25, y: 7 });

        while (targets.length > 0) {
            const target = targets.shift();
            const wp = game.gridPositionToWorldPosition(target.x, target.y);

            let dx = wp.x - this.x;
            let dy = wp.y - this.y;
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance > 20) {
                dx /= distance;
                dy /= distance;

                return {
                    dx,
                    dy,
                };
            }
        }

        return {
            dx: 0,
            dy: 0,
        };
    }

    // update is called every frame, delta is the time in seconds since last update.
    update(delta, game) {
        const p = this.body.getPosition();
        this.x = p.x;
        this.y = p.y;

        const { dx, dy } = this.getTarget(game);

        this.body.setVelocity(dx * this.speed, dy * this.speed);

        this.rotation = Math.atan2(dy, dx);

        if (this.hitFade > 0) {
            this.sprite.tint = lerpColor(0xffffff, 0xff0000, this.hitFade / hitFadeDuration);
            this.hitFade = Math.max(this.hitFade - delta, 0);
        }
    }
}
