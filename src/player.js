import * as PIXI from 'pixi.js';

import { createPlayer } from './physics';

const size = 30*4;

export class Player extends PIXI.Container {
    constructor(x, y, game) {
        super();

        const { x: gx, y: gy } = game.gridPositionToWorldPosition(x, y);
        this.x = gx;
        this.y = gy;

        const g = new PIXI.Graphics();
        g.beginFill(0xffffff);
        g.drawCircle(0, 0, size / 2);
        g.endFill();
        this.addChild(g);

        this.body = createPlayer(size);
        this.body.setPosition(gx, gy);
    }

    update(/*delta, game*/) {
    }
}
