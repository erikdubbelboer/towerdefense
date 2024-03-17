import * as PIXI from 'pixi.js';

export class Tower extends PIXI.Container {
    constructor(x, y, type, game) {
        super();

        const { x: gx, y: gy } = game.gridPositionToWorldPosition(x, y);
        this.x = gx;
        this.y = gy;

        this.type = type;

        if (type === 'crate') {
            const width = 2*30;
            const height = 2*30;
            const lineWidth = 2;
            const g = new PIXI.Graphics();
            g.lineStyle(lineWidth, 0xffffff);
            g.drawRect(-width/2, -height/2, width, height);

            // Number of lines to draw
            const numLines = 3;

            // Extend lines beyond the box dimensions to ensure they cover the entire area
            const extendLine = Math.max(width, height);

            const halfWidth = width / 2;

            // Starting points for the lines on the bottom edge of the box
            for (let i = 0; i <= numLines; i++) {
                let startX = -width + (width / numLines * i);
                let startY = height / 2 - lineWidth / 2;

                let endX = startX + extendLine;
                let endY = startY - extendLine;

                if (startX < -halfWidth) {
                    let excess = -halfWidth - startX;
                    startX += excess;
                    startY -= excess;
                }
                if (endX > halfWidth) {
                    let excess = endX - halfWidth;
                    endX -= excess;
                    endY += excess;
                }

                g.moveTo(startX, startY);
                g.lineTo(endX, endY);
            }

            this.addChild(g);

            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    game.grid[x + i][y + j] = 2;
                }
            }
        } else if (type === 'gun') {
            const width = 2*30;
            const height = 6*30;
            const lineWidth = 2;
            let g = new PIXI.Graphics();
            g.lineStyle(lineWidth, 0xffffff);
            g.drawRect(-width/2, -height/2, width, height);
            g.beginFill(0xffffff, 0.5);
            g.drawRect(-width/2, -height/2, width, height);
            g.endFill();
            this.addChild(g);

            g = new PIXI.Graphics();
            g.lineStyle(2, 0xffffff);
            g.drawCircle(0, 0, 15);
            g.moveTo(-15, 0);
            g.lineStyle(8, 0xffffff);
            g.lineTo(-(15+10), 0);
            this.addChild(g);

            this.gun = g;

            for (let i = -1; i <= 1; i++) {
                for (let j = -3; j <= 3; j++) {
                    game.grid[x + i][y + j] = 2;
                }
            }

            this.nextShoot = 0;
        } else if (type === 'spikes') {
            const width = 4*30;
            const height = 4*30;
            const lineWidth = 2;
            let g = new PIXI.Graphics();
            g.lineStyle(lineWidth, 0xffffff);
            g.drawRect(-width/2, -height/2, width, height);
            this.addChild(g);

            g = new PIXI.Graphics();
            g.lineStyle(2, 0xffffff);
            for (let x = 0; x < 4; x++) {
                for (let y = 0; y < 4; y++) {
                    g.lineStyle(1, 0xffffff);
                    g.drawCircle(-width/2 + 15 + x*30, -height/2 + 15 + y*30, 6);
                }
            }
            this.addChild(g);

            for (let i = -2; i < 2; i++) {
                for (let j = -2; j < 2; j++) {
                    game.grid[x + i][y + j] = 1;
                }
            }
        }
    }

    update(delta, game) {
        if (this.type === 'gun') {
            if (this.enemy && this.enemy.destroyed) {
                this.enemy = null;
            }

            if (!this.enemy) {
                let closestEnemy = null;
                let closestDistance = Infinity;

                // Find the closest enemy
                for (let i = 0; i < game.enemiesContainer.children.length; i++) {
                    const enemy = game.enemiesContainer.children[i];
                    if (enemy.destroyed) continue;

                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const distance = dx*dx + dy*dy;

                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestEnemy = enemy;
                    }
                }

                if (closestEnemy) {
                    this.enemy = closestEnemy;
                }
            }

            if (this.enemy) {
                const dx = this.enemy.x - this.x;
                const dy = this.enemy.y - this.y;
                const distance = Math.sqrt(dx*dx + dy*dy);

                if (distance > 200) {
                    this.enemy = null;
                } else {
                    const angle = Math.PI + Math.atan2(dy, dx);
                    this.gun.rotation = angle;

                    this.nextShoot -= delta;
                    if (this.nextShoot <= 0) {
                        this.nextShoot = 100;

                        this.enemy.damage(0.02);
                    }
                }
            }
        }
    }
}
