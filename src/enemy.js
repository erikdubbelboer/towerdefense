import * as PIXI from 'pixi.js';

import { aStar, turnsOnly, simplifyPath } from './astar';

const images = [];
const width = 60;
const height = 60;

export function init(app) {
    for (let i = 3; i < 10; i++) {
        const c = new PIXI.Container();

        const g = new PIXI.Graphics();
        // Draw an i sided polygon with equal length sides.
        g.beginFill(0xffffff);
        
        // Initialize an empty array for the points
        let points = [];

        // Calculate the radius of the circumcircle to ensure equal side lengths
        const radius = Math.min(width, height) / 2;

        // Center the polygon within the container
        const centerX = width / 2;
        const centerY = height / 2;

        for (let j = 0; j < i; j++) {
            let angle = 2 * Math.PI * j / i; // Angle for each vertex
            let x = centerX + radius * Math.cos(angle); // Calculate x based on center and radius
            let y = centerY + radius * Math.sin(angle); // Calculate y based on center and radius
            points.push(x, y);
        }

        g.drawPolygon(points);
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

        this.sprite = new PIXI.Sprite(images[3]);
        this.sprite.anchor.set(0.5);
        this.addChild(this.sprite);

        this.health = 2;
        this.speed = 0.5;

        this.setSize();
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
        this.setSize();

        if (this.health <= 0) {
            this.destroy();
        }
    }

    // update is called every frame, delta is the time in seconds since last update.
    update(delta, game) {
        if (!this.targets) {
            let { x, y } = game.worldPositionToGridPosition(this.x, this.y);
            this.targets = simplifyPath(game.grid, aStar(game.grid, { x, y }, { x: 25, y: 7 }));
        }

        // Move towards targets[0]
        let target = this.targets[0];
        let { x, y } = game.gridPositionToWorldPosition(target.x, target.y);
        let dx = x - this.x;
        let dy = y - this.y;
        let distance = Math.sqrt(dx*dx + dy*dy);

        if (distance < 1) {
            this.targets.shift();
        } else {
            this.x += this.speed * 0.1 * dx / distance * delta;
            this.y += this.speed * 0.1 * dy / distance * delta;
        }

        this.rotation = Math.atan2(dy, dx);
    }
}
