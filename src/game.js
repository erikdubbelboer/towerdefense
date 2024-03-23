import * as PIXI from 'pixi.js';
import Stats from 'stats.js';
import { default as EventEmitter } from 'eventemitter3';

import { createWorld, step as stepPhysics, destroy as destroyPhysics } from './physics';
import { pointInBox } from './util';
import { aStar } from './astar';
import { Tower, towerTextures } from './tower';
import { Player } from './player';
import { Enemy } from './enemy';

const resumeTimeout = 500;

const gridX = 28;
const gridY = 14;
const gridSize = 30;

export class Game extends EventEmitter {
    constructor(loader) {
        super();

        this.loader = loader;
        this.app = loader.app;
        this.sounds = loader.sounds;

        if (window.isDebug) {
            this.statsCreate();

            this.drawCalls = 0;
            this.oldDrawElements = this.app.renderer.gl.drawElements;
            this.app.renderer.gl.drawElements = (...args) => {
                this.oldDrawElements.call(this.app.renderer.gl, ...args);
                this.drawCalls++;
            };
        }

        // We create our own ticker for our game loop separate from the ticker PIXI uses for rendering.
        this.ticker = new PIXI.Ticker();

        this.gameSpeed = 1;
        this.ticker.speed = this.gameSpeed;

        // When the user switches tabs or minimizes the window we pause the game.
        this.pageHideBlurHandler = () => {
            PIXI.Ticker.shared.stop();
            if (this.ticker.started) {
                // Show the paused menu.
                this.pause(true);
            }
        };
        window.addEventListener('pagehide', this.pageHideBlurHandler);
        window.addEventListener('blur', this.pageHideBlurHandler);

        this.pageShowFocusHandler = () => {
            // Only when the game is over do we automatically resume.
            // Otherwise the pause menu will be shown and the user can resume manually.
            if (this.gameover) {
                this.resume(0);
            }
        };
        window.addEventListener('pageshow', this.pageShowFocusHandler);
        window.addEventListener('focus', this.pageShowFocusHandler);

        this.resumeContainer = document.getElementById('resume-container');
        this.resumeText = document.getElementById('resume-text');
        this.resumeButton = document.getElementById('resume-button');
        this.exitButton = document.getElementById('exit-button');

        this.resumeHandler = () => {
            this.sounds.play('click');
            this.resume(resumeTimeout);
        };
        this.resumeButton.addEventListener('click', this.resumeHandler);

        this.exitHandler = () => {
            this.sounds.play('click');
            this.endGame(false);
        };
        this.exitButton.addEventListener('click', this.exitHandler);

        this.setup();
    }

    // Create multiple Stats panels so we can show drawcalls, frame time and fps at the same time.
    statsCreate() {
        this.statsFPS = new Stats();
        this.statsFPS.dom.style.top = '';
        this.statsFPS.dom.style.bottom = '0px';
        document.body.appendChild(this.statsFPS.dom);

        this.statsMS = new Stats();
        this.statsMS.dom.style.top = '';
        this.statsMS.dom.style.bottom = '50px';
        this.statsMS.showPanel(1);
        document.body.appendChild(this.statsMS.dom);

        this.statsDrawCalls = new Stats();
        this.statsDrawCallsPanel = new Stats.Panel('drawcalls', '#0ff', '#002');
        this.statsDrawCallsPanel.max = 1;
        this.statsDrawCalls.addPanel(this.statsDrawCallsPanel);
        this.statsDrawCalls.showPanel(3);
        this.statsDrawCalls.dom.style.top = '';
        this.statsDrawCalls.dom.style.bottom = '100px';
        document.body.appendChild(this.statsDrawCalls.dom);
    }

    statsBegin() {
        if (!this.statsFPS) {
            return;
        }

        this.statsMS.begin();
        this.statsFPS.begin();
        this.statsDrawCalls.begin();
        if (this.drawCalls > this.statsDrawCallsPanel.max) {
            this.statsDrawCallsPanel.max = this.drawCalls;
        }
        this.statsDrawCallsPanel.update(this.drawCalls, this.statsDrawCallsPanel.max);
        this.drawCalls = 0;
    }

    statsEnd() {
        if (!this.statsFPS) {
            return;
        }

        this.statsDrawCalls.end();
        this.statsFPS.end();
        this.statsMS.end();
    }

    setGameSpeed(speed) {
        this.gameSpeed = speed;

        // Pitch the sound up as the game speed increases.
        if (this.gameSpeed === 2) {
            this.sounds.rate(1.02);
        } else if (this.gameSpeed === 3) {
            this.sounds.rate(1.04);
        } else {
            this.sounds.rate(1);
        }

        this.ticker.speed = this.gameSpeed;
    }

    resume(ms) {
        if (this.gameover) {
            return;
        }

        if (this.resumeTimeout) {
            clearTimeout(this.resumeTimeout);
        }

        if (window.PokiSDK) {
            PokiSDK.gameplayStart();
        }

        this.resumeContainer.style.display = 'none';

        // When the user resumes the game we always wait a bit before actually resuming the game.
        this.resumeTimeout = window.setTimeout(() => {
            if (this.destroyed) {
                return;
            }

            this.sounds.resume();
            this.sounds.resumeMusic();

            this.ticker.start();
            PIXI.Ticker.shared.start();
        }, ms || 0);
    }

    pause(showMenu) {
        if (this.gameover) {
            return;
        }

        if (this.resumeTimeout) {
            clearTimeout(this.resumeTimeout);
        }

        this.sounds.pause();

        this.ticker.stop();
        PIXI.Ticker.shared.stop();

        if (window.PokiSDK) {
            PokiSDK.gameplayStop();
        }

        if (showMenu) {
            this.resumeText.innerText = 'PAUSED';
            this.resumeButton.style.display = 'block';
            this.resumeContainer.style.display = 'flex';
        }
    }

    setup() {
        this.ticker.start();
        PIXI.Ticker.shared.start();

        // We put the whole world in a container so we can pivot it around the player if needed.
        this.worldContainer = new PIXI.Container();
        this.worldContainer.pivot.x = 0;
        this.worldContainer.pivot.y = 0;
        this.app.stage.addChild(this.worldContainer);

        this.realScreenWidth = this.app.screen.width;
        this.realScreenHeight = this.app.screen.height;

        this.resizeHandler = () => {
            this.resize();
        };
        window.addEventListener('resize', this.resizeHandler);
        window.addEventListener('orientationchange', this.resizeHandler);

        this.pointerIsDown = false;
        this.lastPointerX = false;
        this.lastPointerY = false;

        // We only listen for pointer events on the stage, not on separate objects.
        this.app.stage.eventMode = 'static';
        this.app.stage.interactiveChildren = false;
        this.app.stage.hitArea = this.app.screen;

        this.pointerDownHandler = (event) => {
            this.pointerdown(event);
        };
        this.app.stage.addEventListener('pointerdown', this.pointerDownHandler);
        this.pointerUpHandler = (event) => {
            this.pointerup(event);
        };
        this.app.stage.addEventListener('pointerup', this.pointerUpHandler);
        this.pointerMoveHandler = (event) => {
            this.pointermove(event);
        };
        this.app.stage.addEventListener('pointermove', this.pointerMoveHandler);

        this.keydownHandler = this.keydown.bind(this);
        document.addEventListener('keydown', this.keydownHandler);

        this.touchmoveHandler = this.touchmove.bind(this);
        document.addEventListener('touchmove', this.touchmoveHandler, {
            passive: false,
        });

        this.pointerOutHandler = (event) => {
            this.pointerup(event);
        };
        document.addEventListener('pointerout', this.pointerOutHandler);

        this.gameover = 0;
        this.worldScale = 1;

        this.levelContainer = new PIXI.Container();
        this.gridOverlayContainer = new PIXI.Container();
        this.towerContainer = new PIXI.Container();
        this.enemiesContainer = new PIXI.Container();
        this.uiContainer = new PIXI.Container();

        this.worldContainer.addChild(this.levelContainer);
        this.worldContainer.addChild(this.towerContainer);
        this.worldContainer.addChild(this.gridOverlayContainer);
        this.worldContainer.addChild(this.enemiesContainer);
        this.worldContainer.addChild(this.uiContainer);

        this.resize();

        const buttons = ['crate', 'gun', 'spikes', 'flame'];
        for (let i = 0; i < buttons.length; i++) {
            const button = new PIXI.Container();
            button.scale.set(0.5);
            button.type = buttons[i];
            this.uiContainer.addChild(button);
            const s = new PIXI.Sprite(towerTextures[button.type]);
            s.anchor.set(0.5);
            button.addChild(s);
            const g = new PIXI.Graphics();
            g.lineStyle(4, 0xffffff);
            g.drawRect(-100, -100, 200, 200);
            button.addChild(g);

            button.position.x = 120 * (i - buttons.length / 2);
        }

        createWorld();

        this.grid = [];
        for (let x = 0; x < gridX; x++) {
            this.grid[x] = [];
            for (let y = 0; y < gridY; y++) {
                this.grid[x][y] = {
                    place: 0,
                    nav: 0,
                };
            }
        }

        this.buildGrid();

        let tower;
        
        tower = new Tower(6, 1, 'crate', this);
        tower.putdown(this);
        this.towerContainer.addChild(tower);

        tower = new Tower(6, 5, 'gun', this);
        tower.putdown(this);
        this.towerContainer.addChild(tower);

        tower = new Tower(12, 5, 'gun', this);
        tower.putdown(this);
        this.towerContainer.addChild(tower);

        tower = new Tower(12, 11, 'gun', this);
        tower.putdown(this);
        this.towerContainer.addChild(tower);

        tower = new Tower(16, 5, 'gun', this);
        tower.putdown(this);
        this.towerContainer.addChild(tower);

        tower = new Tower(6, 10, 'spikes', this);
        tower.putdown(this);
        this.towerContainer.addChild(tower);

        //tower = new Tower(8, -1, 'flame', this);
        //tower.putdown(this);
        //this.towerContainer.addChild(tower);

        // flame
        // sniper
        // tesla
        // freeze
        // grinder

        this.player = new Player(25, 7, this);
        this.worldContainer.addChild(this.player);

        this.gridOverlayContainer.visible = false;

        const startX = -this.halfScreenWidth + (this.screenWidth - gridX * gridSize) / 2;
        const gridHeight = gridY * gridSize;

        let enemiesToSpawn = 1000;
        const cancelSpawnInterval = this.interval(() => {
            const n = 4;
            for (let i = 0; i < n; i++) {
                const e = new Enemy(startX, -this.halfScreenHeight + 100 +  Math.random() * gridHeight);
                this.enemiesContainer.addChild(e);
            }
            enemiesToSpawn -= n;
            if (enemiesToSpawn <= 0) {
                cancelSpawnInterval();
            }
        }, 1000);

        this.mainLoop();
    }

    gridSetNav(x, y, nav) {
        if (x >= 0 && x < this.grid.length) {
            if (y >= 0 && y < this.grid[x].length) {
                this.grid[x][y].nav += nav;
            }
        }
    }

    gridSetPlace(x, y, place) {
        if (x >= 0 && x < this.grid.length) {
            if (y >= 0 && y < this.grid[x].length) {
                this.grid[x][y].place += place;
            }
        }
    }

    gridGetNav(x, y) {
        if (x >= 0 && x < this.grid.length) {
            if (y >= 0 && y < this.grid[x].length) {
                return this.grid[x][y].nav;
            }
        }

        return 1;
    }

    gridGetPlace(x, y) {
        if (x >= 0 && x < this.grid.length) {
            if (y >= 0 && y < this.grid[x].length) {
                return this.grid[x][y].place;
            }
        }

        return 1;
    }

    buildGrid() {
        const lineAlpha = 0.1;
        this.gridStartX = (this.screenWidth - gridX * gridSize) / 2;
        this.gridStartY = 100;
        for (let x = 4; x < gridX; x++) {
            for (let y = 0; y < gridY; y++) {
                const g = new PIXI.Graphics();
                g.lineStyle(1, 0xffffff, lineAlpha);
                g.drawRect(-this.halfScreenWidth + this.gridStartX + x * gridSize, -this.halfScreenHeight + this.gridStartY + y * gridSize, gridSize, gridSize);
                this.levelContainer.addChild(g);
            }
        }
        const g = new PIXI.Graphics();
        g.lineStyle(1, 0xffffff, lineAlpha);
        g.drawRect(-this.halfScreenWidth + this.gridStartX, -this.halfScreenHeight + this.gridStartY, gridSize * gridX, gridSize * gridY);
        this.levelContainer.addChild(g);
    }

    buildGridOverlay() {
        while (this.gridOverlayContainer.children.length > 0) {
            this.gridOverlayContainer.children[0].destroy({ children: true });
        }

        for (let x = 4; x < gridX; x++) {
            for (let y = 0; y < gridY; y++) {
                if (this.grid[x][y].place > 0) {
                    const g = new PIXI.Graphics();
                    g.beginFill(0xff0000, 0.5);
                    g.drawRect(-this.halfScreenWidth + this.gridStartX + x * gridSize, -this.halfScreenHeight + this.gridStartY + y * gridSize, gridSize, gridSize);
                    g.endFill();
                    this.gridOverlayContainer.addChild(g);
                }
            }
        }
    }

    gridPositionToWorldPosition(x, y) {
        return {
            x: -this.halfScreenWidth + this.gridStartX + x * gridSize,
            y: -this.halfScreenHeight + this.gridStartY + y * gridSize,
        };
    }

    worldPositionToGridPosition(x, y) {
        return {
            x: Math.round((x + this.halfScreenWidth - this.gridStartX) / gridSize),
            y: Math.round((y + this.halfScreenHeight - this.gridStartY) / gridSize),
        };
    }

    setWorldScale(scale) {
        this.worldScale = scale;

        this.worldContainer.scale.x = scale;
        this.worldContainer.scale.y = scale;

        this.screenWidth = this.app.screen.width / scale;
        this.screenHeight = this.app.screen.height / scale;
        this.halfScreenWidth = this.screenWidth / 2;
        this.halfScreenHeight = this.screenHeight / 2;

        this.worldContainer.pivot.x = 0;
        this.worldContainer.pivot.y = 0;
        this.worldContainer.x = this.halfScreenWidth;
        this.worldContainer.y = this.halfScreenHeight;
    }

    resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        const m = 1200 / Math.max(width, height);

        this.realScreenWidth = width * m;
        this.realScreenHeight = height * m;
        const ratio = this.realScreenWidth / this.realScreenHeight;
        if (this.realScreenWidth > this.realScreenHeight) {
            this.realScreenWidth = Math.min(this.realScreenWidth, 1200);
            this.realScreenHeight = this.realScreenWidth / ratio;
        } else {
            this.realScreenHeight = Math.min(this.realScreenHeight, 1200);
            this.realScreenWidth = this.realScreenHeight * ratio;
        }

        this.app.renderer.resize(this.realScreenWidth, this.realScreenHeight);

        this.setWorldScale(this.worldScale);

        if (ratio < 1) {
            this.worldContainer.rotation = Math.PI / 2;
            this.halfScreenWidth = this.screenHeight / 2;
            this.halfScreenHeight = this.screenWidth / 2;
            this.portrait = true;
        } else {
            this.worldContainer.rotation = 0;
            this.halfScreenWidth = this.screenWidth / 2;
            this.halfScreenHeight = this.screenHeight / 2;
            this.portrait = false;
        }

        this.worldContainer.filterArea = new PIXI.Rectangle(0, 0, this.app.screen.width, this.app.screen.height);

        this.uiContainer.position.y = this.halfScreenHeight - 50;
    }

    // Execute f every frame.
    // Returns a function that can be called to remove the tick.
    tick(f) {
        if (this.destroyed) {
            console.warn('add tick after destroy', f);
            return;
        }

        const cb = () => {
            if (this.destroyed) {
                return;
            }

            f(this.ticker.deltaMS);
        };
        this.ticker.add(cb);
        return () => {
            this.ticker.remove(cb);
        };
    }

    // Execute f once after the next frame.
    // Returns a function that can be called to remove the tick.
    tickOnce(f) {
        if (this.destroyed) {
            console.warn('add tickOnce after destroy', f);
            return;
        }

        this.ticker.addOnce(f);
        return () => {
            this.ticker.remove(f);
        };
    }

    // Execute f every ms milliseconds of game time.
    // interval unlike window.setInterval will trigger
    // immediately and then wait for the interval unless startWithDelay is true.
    // Returns a function that can be called to cancel the interval.
    interval(f, ms, startWithDelay = false) {
        if (!ms) {
            throw new Error('interval ms is 0');
        }

        if (this.destroyed) {
            console.warn('add interval after destroy', f);
            return;
        }

        let next = startWithDelay ? ms : 0;
        const cb = () => {
            if (this.destroyed) {
                return;
            }

            next -= this.ticker.deltaMS;

            if (next <= 0) {
                f();
                next = ms;
            }
        };
        this.ticker.add(cb);
        return () => {
            this.ticker.remove(cb);
        };
    }

    // Execute f after ms milliseconds of game time.
    // Returns a function that can be called to cancel the timeout.
    timeout(f, ms) {
        if (this.destroyed) {
            return;
        }

        let next = ms;
        let rm = () => {};
        const cb = () => {
            if (this.destroyed) {
                return;
            }

            next -= this.ticker.deltaMS;

            if (next <= 0) {
                rm();
                f();
            }
        };
        this.ticker.add(cb);
        rm = () => {
            this.ticker.remove(cb);
        };
        return rm;
    }

    // Check if a point is in the screen with s being the size of the object.
    isInScreen(x, y, s) {
        if (x + s < -this.halfScreenWidth || x - s > this.halfScreenWidth) {
            return false;
        }
        if (y + s < -this.halfScreenHeight || y - s > this.halfScreenHeight) {
            return false;
        }

        return true;
    }

    touchmove(event) {
        event.preventDefault();
    }

    keydown(event) {
        switch (event.code) {
            // P and Escape are used to pause or resume the game.
            case 'KeyP':
            case 'Escape':
                if (this.ticker.started) {
                    this.pause(true);
                } else {
                    this.resume(resumeTimeout);
                }
                break;
            // O is used to toggle the stats panel.
            case 'KeyO': {
                if (this.statsFPS) {
                    const display = this.statsFPS.dom.style.display === 'none' ? 'block' : 'none';
                    this.statsFPS.dom.style.display = display;
                    this.statsMS.dom.style.display = display;
                    this.statsDrawCalls.dom.style.display = display;
                }
                break;
            }
            // Make sure the arrow keys don't scroll the page.
            case 'ArrowDown':
            case 'ArrowUp': {
                event.preventDefault();
                break;
            }
            // Space resumes the game if paused, or exits if gameover.
            case 'Space': {
                if (this.gameover) {
                    this.exitHandler();
                } else {
                    // It's a bit hacky but it works.
                    if (this.resumeContainer.style.display !== 'none') {
                        this.resumeHandler();
                    }
                }
                break;
            }
        }
    }

    pointerdown(event) {
        let x = event.data.global.x - this.worldContainer.x;
        let y = event.data.global.y - this.worldContainer.y;

        if (this.portrait) {
            const tmp = x;
            x = y;
            y = -tmp;
        }

        if (event.button === 2) {
            console.log('right mouse click at', x, y);
        }

        for (let i = 0; i < this.towerContainer.children.length; i++) {
            const tower = this.towerContainer.children[i];

            if (tower.isOn(x, y)) {
                this.setGameSpeed(0.1);
                tower.liftup(this);
                this.selectedTower = tower;
                this.buildGridOverlay();
                this.gridOverlayContainer.visible = true;
                break;
            }
        }

        for (let i = 0; i < this.uiContainer.children.length; i++) {
            const button = this.uiContainer.children[i];

            const b = button.getBounds();
            if (pointInBox(event.data.global, {
                x: b.x + (b.width / 2),
                y: b.y + (b.height / 2),
            }, b.width, b.height)) {
                const tower = new Tower(0, 0, button.type, this);
                this.towerContainer.addChild(tower);

                this.selectedTower = tower;

                const gp = this.worldPositionToGridPosition(x, y);
                const wp = this.gridPositionToWorldPosition(gp.x, gp.y);

                this.selectedTower.gp = gp;
                this.selectedTower.x = wp.x;
                this.selectedTower.y = wp.y;
                this.selectedTower.placingValid = true;

                this.setGameSpeed(0.1);
                this.buildGridOverlay();
                this.gridOverlayContainer.visible = true;
                break;
            }
        }
    }

    pointerup() {
        if (this.selectedTower) {
            if (!this.selectedTower.placingValid) {
                this.selectedTower.destroy();
            } else {
                this.selectedTower.putdown(this);
            }
            this.selectedTower = null;
            this.setGameSpeed(1);
            this.gridOverlayContainer.visible = false;
        }
    }

    pointermove(event) {
        let x = event.data.global.x - this.worldContainer.x;
        let y = event.data.global.y - this.worldContainer.y;

        if (this.portrait) {
            const tmp = x;
            x = y;
            y = -tmp;
        }

        if (this.selectedTower) {
            const gp = this.worldPositionToGridPosition(x, y);
            const wp = this.gridPositionToWorldPosition(gp.x, gp.y);

            this.selectedTower.gp = gp;
            this.selectedTower.x = wp.x;
            this.selectedTower.y = wp.y;

            this.selectedTower.placingValid = true;

            if (!this.selectedTower.canPutdown(this)) {
                this.selectedTower.placingValid = false;
                this.selectedTower.alpha = 0.5;
            } else {
                this.selectedTower.alpha = 1;
                this.selectedTower.putdown(this);
                const targets = aStar(this.grid, {
                    x: 0,
                    y: Math.floor(gridY / 2),
                }, { x: 25, y: 7 });
                if (targets.length === 0) {
                    this.selectedTower.placingValid = false;
                }
                this.selectedTower.liftup(this);
            }
        }
    }

    die() {
        this.gameover = 1;

        // Show the game over screen after 1 second of game time.
        this.timeout(() => {
            this.gameover = 2;

            if (this.resumeTimeout) {
                clearTimeout(this.resumeTimeout);
            }

            this.ticker.stop();
            PIXI.Ticker.shared.stop();

            this.resumeText.innerText = 'GAME OVER';
            this.resumeButton.style.display = 'none';
            this.resumeContainer.style.display = 'flex';
        }, 1000);
    }

    mainLoop() {
        this.ticker.add(() => {
            const delta = this.ticker.deltaMS;

            this.statsBegin();

            // If it's gameover we don't update anything.
            if (!this.gameover) {
                stepPhysics(delta);

                // Tight update loops to make full use of the CPU caches and JIT optimizations.
                for (let i = 0; i < this.enemiesContainer.children.length; i++) {
                    const enemy = this.enemiesContainer.children[i];

                    enemy.update(delta, this);

                    // If the asteroid is destroyed it will get remove from the container
                    // so we need to decrement i to not skip the next asteroid.
                    if (enemy.destroyed) {
                        i--;
                    }
                }

                for (let i = 0; i < this.towerContainer.children.length; i++) {
                    const tower = this.towerContainer.children[i];

                    tower.update(delta, this);
                }
            }

            this.statsEnd();
        });
    }

    // Make sure to clean up all our resources
    // since the next game will use the same PIXI.Application.
    // We don't want any memory leaks or event listeners that would start throwing errors.
    destroy() {
        this.destroyed = true;

        this.sounds.rate(1);

        if (this.statsFPS) {
            this.statsFPS.dom.remove();
            this.statsMS.dom.remove();
            this.statsDrawCalls.dom.remove();
        }

        if (this.resumeTimeout) {
            clearTimeout(this.resumeTimeout);
        }

        PIXI.Ticker.shared.stop();

        this.ticker.destroy();
        this.ticker = null;

        for (let p = this.emittersContainer.firstChild; p; p = this.emittersContainer.firstChild) {
            p.emitter.destroy();
        }

        while (this.app.stage.children.length > 0) {
            this.app.stage.children[0].destroy({ children: true });
        }

        destroyPhysics();

        window.removeEventListener('resize', this.resizeHandler);
        window.removeEventListener('orientationchange', this.resizeHandler);
        window.removeEventListener('pagehide', this.pageHideBlurHandler);
        window.removeEventListener('blur', this.pageHideBlurHandler);
        window.removeEventListener('pageshow', this.pageShowFocusHandler);
        window.removeEventListener('focus', this.pageShowFocusHandler);

        this.app.stage.removeEventListener('pointerdown', this.pointerDownHandler);
        this.app.stage.removeEventListener('pointerup', this.pointerUpHandler);
        this.app.stage.removeEventListener('pointermove', this.pointerMoveHandler);

        document.removeEventListener('keydown', this.keydownHandler);
        document.removeEventListener('touchmove', this.touchmoveHandler);
        document.removeEventListener('pointerout', this.pointeroutHandler);

        this.resumeContainer.style.display = 'none';

        this.resumeContainer.removeEventListener('click', this.resumeHandler);
        this.exitButton.removeEventListener('click', this.exitHandler);

        if (this.oldDrawElements) {
            this.app.renderer.gl.drawElements = this.oldDrawElements;
        }
    }

    endGame(restart) {
        this.destroy();

        this.emit('done', restart, false);
    }
}
