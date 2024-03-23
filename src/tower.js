import * as PIXI from 'pixi.js';

import { createTower } from './physics';
import { pointInBox } from './util';

export const towerTextures = {};

function drawCrate(c) {
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
            const excess = -halfWidth - startX;
            startX += excess;
            startY -= excess;
        }
        if (endX > halfWidth) {
            const excess = endX - halfWidth;
            endX -= excess;
            endY += excess;
        }

        g.moveTo(startX, startY);
        g.lineTo(endX, endY);
    }

    c.addChild(g);
}

function drawGun(c) {
    const width = 2*30;
    const height = 6*30;
    const lineWidth = 2;
    let g = new PIXI.Graphics();
    g.lineStyle(lineWidth, 0xffffff);
    g.drawRect(-width/2, -height/2, width, height);
    g.beginFill(0xffffff, 0.5);
    g.drawRect(-width/2, -height/2, width, height);
    g.endFill();
    c.addChild(g);

    g = new PIXI.Graphics();
    g.lineStyle(2, 0xffffff);
    g.drawCircle(0, 0, 15);
    g.moveTo(-15, 0);
    g.lineStyle(8, 0xffffff);
    g.lineTo(-(15+10), 0);
    c.addChild(g);

    return g;
}

function drawSpikes(c) {
    const width = 4*30;
    const height = 4*30;
    const lineWidth = 2;
    let g = new PIXI.Graphics();
    g.lineStyle(lineWidth, 0xffffff);
    g.drawRect(-width/2, -height/2, width, height);
    c.addChild(g);

    const spikes = new PIXI.Graphics();
    spikes.beginFill(0xff0000);
    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
            spikes.drawCircle(-width/2 + 15 + x*30, -height/2 + 15 + y*30, 6);
        }
    }
    c.addChild(spikes);

    g = new PIXI.Graphics();
    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
            g.lineStyle(1, 0xffffff);
            g.drawCircle(-width/2 + 15 + x*30, -height/2 + 15 + y*30, 6);
        }
    }
    c.addChild(g);

    return spikes;
}

function drawFlame(c) {
    const width = 2*30;
    const height = 1*30;
    const lineWidth = 2;
    const g = new PIXI.Graphics();
    g.lineStyle(lineWidth, 0xffffff, 0.5);
    g.drawRect(-width/2, -height, width, height);

    g.lineStyle(lineWidth, 0xffffff);
    g.drawRect(-width/2, 0, width, height);

    g.beginFill(0xff0000);
    g.moveTo(-width/2, height);
    g.lineTo(0, 0);
    g.lineTo(width/2, height);
    g.endFill();

    c.addChild(g);

    return g;
}

export function init(app) {
    let c = new PIXI.Container();
    drawCrate(c);
    c.position.x = 100;
    c.position.y = 100;
    let t = PIXI.RenderTexture.create({ width: 200, height: 200 });
    app.renderer.render(c, { renderTexture: t });
    towerTextures.crate = t;

    c = new PIXI.Container();
    drawGun(c);
    c.position.x = 100;
    c.position.y = 100;
    t = PIXI.RenderTexture.create({ width: 200, height: 200 });
    app.renderer.render(c, { renderTexture: t });
    towerTextures.gun = t;

    c = new PIXI.Container();
    drawSpikes(c);
    c.position.x = 100;
    c.position.y = 100;
    t = PIXI.RenderTexture.create({ width: 200, height: 200 });
    app.renderer.render(c, { renderTexture: t });
    towerTextures.spikes = t;

    c = new PIXI.Container();
    drawFlame(c);
    c.position.x = 100;
    c.position.y = 100;
    t = PIXI.RenderTexture.create({ width: 200, height: 200 });
    app.renderer.render(c, { renderTexture: t });
    towerTextures.flame = t;
}

export class Tower extends PIXI.Container {
    constructor(x, y, type, game) {
        super();

        this.gp = { x, y };

        const { x: wx, y: wy } = game.gridPositionToWorldPosition(x, y);
        this.x = wx;
        this.y = wy;

        /*const gg = new PIXI.Graphics();
        gg.beginFill(0xff0000);
        gg.drawCircle(0, 0, 5);
        gg.endFill();
        this.addChild(gg);*/

        this.type = type;

        if (type === 'crate') {
            drawCrate(this);

            this.body = createTower(this.width, this.height);
            this.body.setPosition(wx, wy);
        } else if (type === 'gun') {
            this.gun = drawGun(this);

            this.nextShoot = 0;

            this.body = createTower(this.width, this.height);
            this.body.setPosition(wx, wy);
        } else if (type === 'spikes') {
            this.spikes = drawSpikes(this);
            this.spikes.alpha = 0;
            this.nextShoot = 0;
        } else if (type === 'flame') {
            this.flame = drawFlame(this);
            this.nextShoot = 0;

            const g = new PIXI.Graphics();
            g.beginFill(0xff0000, 0.5);
            g.drawRect(-30, 0, 60, 200);
            g.endFill();
            this.addChild(g);
            g.alpha = 0;
            this.fire = g;
        }

        this.active = false;
    }

    isOn(x, y) {
        if (this.type === 'gun') {
            return pointInBox({x, y}, this, this.width, this.height);
        } else if (this.type === 'spikes') {
            return pointInBox({x, y}, this, this.width, this.height);
        } else if (this.type === 'flame') {
            return pointInBox({x, y}, this, this.width, this.height);
        }

        return false;
    }

    liftup(game) {
        this.active = false;

        if (this.type === 'crate') {
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    game.gridSetNav(this.gp.x + i, this.gp.y + j, -1);
                    if (i < 1 && j < 1) {
                        game.gridSetPlace(this.gp.x + i, this.gp.y + j, -1);
                    }
                }
            }
        } else if (this.type === 'gun') {
            for (let i = -1; i <= 1; i++) {
                for (let j = -3; j <= 3; j++) {
                    game.gridSetNav(this.gp.x + i, this.gp.y + j, -1);
                    if (i < 1 && j < 3) {
                        game.gridSetPlace(this.gp.x + i, this.gp.y + j, -1);
                    }
                }
            }
        } else if (this.type === 'spikes') {
            for (let i = -2; i < 2; i++) {
                for (let j = -2; j < 2; j++) {
                    game.gridSetPlace(this.gp.x + i, this.gp.y + j, -1);
                }
            }
        }

        this.active = false;
    }

    putdown(game) {
        this.gp = game.worldPositionToGridPosition(this.x, this.y);

        if (this.type === 'crate') {
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    game.gridSetNav(this.gp.x + i, this.gp.y + j, 1);
                    if (i < 1 && j < 1) {
                        game.gridSetPlace(this.gp.x + i, this.gp.y + j, 1);
                    }
                }
            }
        } else if (this.type === 'gun') {
            for (let i = -1; i <= 1; i++) {
                for (let j = -3; j <= 3; j++) {
                    game.gridSetNav(this.gp.x + i, this.gp.y + j, 1);
                    if (i < 1 && j < 3) {
                        game.gridSetPlace(this.gp.x + i, this.gp.y + j, 1);
                    }
                }
            }

            this.body.setPosition(this.x, this.y);
        } else if (this.type === 'spikes') {
            for (let i = -2; i < 2; i++) {
                for (let j = -2; j < 2; j++) {
                    game.gridSetPlace(this.gp.x + i, this.gp.y + j, 1);
                }
            }
        }

        this.active = true;
    }

    canPutdown(game) {
        this.gp = game.worldPositionToGridPosition(this.x, this.y);

        if (this.type === 'crate') {
            for (let i = -1; i < 1; i++) {
                for (let j = -1; j < 1; j++) {
                    if (game.gridGetPlace(this.gp.x + i, this.gp.y + j, 1) > 0) {
                        return false;
                    }
                }
            }
        } else if (this.type === 'gun') {
            for (let i = -1; i < 1; i++) {
                for (let j = -3; j < 3; j++) {
                    if (game.gridGetPlace(this.gp.x + i, this.gp.y + j, 1) > 0) {
                        return false;
                    }
                }
            }

            this.body.setPosition(this.x, this.y);
        } else if (this.type === 'spikes') {
            for (let i = -2; i < 2; i++) {
                for (let j = -2; j < 2; j++) {
                    if (game.gridGetPlace(this.gp.x + i, this.gp.y + j, 1) > 0) {
                        return false;
                    }
                }
            }
        } else if (this.type === 'flame') {
            for (let i = 0; i < game.towerContainer.children.length; i++) {
                const tower = game.towerContainer.children[i];

                if (tower.type === 'flame' && tower !== this) {
                    if (tower.gp.y === this.gp.y) {
                        if (this.gp.x === tower.gp.x || this.gp.x === tower.gp.x - 1 || this.gp.x === tower.gp.x + 1) {
                            return false;
                        }
                    }
                }
            }

            for (let i = -1; i < 1; i++) {
                for (let j = -1; j < 0; j++) {
                    const x = this.gp.x + i;
                    const y = this.gp.y + j;

                    if (x < 4 || x >= game.grid.length - 1) {
                        return false;
                    }
                    if (y === -1) {
                        this.flame.rotation = Math.PI;
                        this.fire.rotation = 0;
                        return true;
                    }
                    if (y === game.grid[x].length - 1) {
                        this.flame.rotation = 0;
                        this.fire.rotation = Math.PI;
                        return true;
                    }
                }
            }

            return false;
        } else {
            return false;
        }

        return true;
    }

    destroy(opts) {
        if (this.body) {
            this.body.destroy();
        }

        super.destroy(opts);
    }

    update(delta, game) {
        if (!this.active) {
            return;
        }

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

                        this.enemy.damage(0.1);
                    }
                }
            }
        } else if (this.type === 'spikes') {
            this.nextShoot -= delta;
            this.spikes.alpha = Math.max(this.spikes.alpha - delta*0.002, 0);
            if (this.nextShoot <= 0) {
                this.nextShoot = 1000;
                this.spikes.alpha = 1;

                for (let i = 0; i < game.enemiesContainer.children.length; i++) {
                    const enemy = game.enemiesContainer.children[i];
                    if (enemy.destroyed) continue;

                    if (pointInBox(enemy, this, this.width, this.height)) {
                        enemy.damage(0.5);
                    }
                }
            }
        } else if (this.type === 'flame') {
            this.nextShoot -= delta;
            this.fire.alpha = Math.max(this.fire.alpha - delta*0.001, 0);
            if (this.nextShoot <= 0) {
                this.nextShoot = 1000;
                this.fire.alpha = 1;

                for (let i = 0; i < game.enemiesContainer.children.length; i++) {
                    const enemy = game.enemiesContainer.children[i];
                    if (enemy.destroyed) continue;

                    if (this.gp.y === 0) {
                        if (pointInBox(enemy, {
                            x: this.x,
                            y: this.y + 100,
                        }, 60, 200)) {
                            enemy.damage(0.5);
                        }
                    } else {
                        if (pointInBox(enemy, {
                            x: this.x,
                            y: this.y - 100,
                        }, 60, 200)) {
                            enemy.damage(0.5);
                        }
                    }
                }
            }
        }
    }
}
