let gvec1;
let gvec2;
let gdef;
let gfixture;
let gfilter;
let gcircle;
let gpolygon;

let world;
let bodies = [];

const Box2DScale = 10;
const Box2DSpeed = 0.01;

export const categoryTower = 0x0001;
export const categoryEnemy = 0x0002;
export const categoryProjectile = 0x0004;
export const categoryBoundary = 0x0008;

export function init() {
    gvec1 = new Box2D.b2Vec2(0, 0);
    gvec2 = new Box2D.b2Vec2(0, 0);
    gdef = new Box2D.b2BodyDef();
    gfixture = new Box2D.b2FixtureDef();
    gfilter = new Box2D.b2Filter();
    gcircle = new Box2D.b2CircleShape();
    gpolygon = new Box2D.b2PolygonShape();
}

export function destroy() {
    for (let i = 0; i < bodies.length; i++) {
        world.DestroyBody(bodies[i]);
    }
    bodies = null;

    if (world.GetBodyCount() > 0) {
        console.error(world.GetBodyCount(), 'bodies not destroyed!');
    }
    if (world.GetJointCount() > 0) {
        console.error(world.GetJointCount(), 'joints not destroyed!');
    }

    Box2D.destroy(world);

    world = null;
}

export function createWorld() {
    const levelSize = 5000;
    const worldSizeBox2D = levelSize / Box2DScale;

    gvec1.Set(0, 0);
    world = new Box2D.b2World(gvec1);

    const edgeDef = new Box2D.b2BodyDef();
    const edgeShape = new Box2D.b2EdgeShape();
    const edgeFixture = new Box2D.b2FixtureDef();
    const edgeFilter = new Box2D.b2Filter();

    edgeFixture.set_density(1);
    edgeFixture.set_friction(0);
    edgeFixture.set_restitution(0);
    edgeFixture.set_isSensor(false);
    edgeFilter.categoryBits = categoryBoundary;
    edgeFilter.maskBits = categoryEnemy;
    edgeFilter.groupIndex = 0;
    edgeFixture.set_filter(edgeFilter);

    gvec1.Set(-worldSizeBox2D, -worldSizeBox2D);
    gvec2.Set(-worldSizeBox2D, worldSizeBox2D);
    edgeShape.SetTwoSided(gvec1, gvec2);
    edgeFixture.set_shape(edgeShape);
    const edgeLeft = world.CreateBody(edgeDef);
    edgeLeft.CreateFixture(edgeFixture);

    gvec1.Set(worldSizeBox2D, -worldSizeBox2D);
    gvec2.Set(worldSizeBox2D, worldSizeBox2D);
    edgeShape.SetTwoSided(gvec1, gvec2);
    edgeFixture.set_shape(edgeShape);
    const edgeRight = world.CreateBody(edgeDef);
    edgeRight.CreateFixture(edgeFixture);

    gvec1.Set(-worldSizeBox2D, -worldSizeBox2D);
    gvec2.Set(worldSizeBox2D, -worldSizeBox2D);
    edgeShape.SetTwoSided(gvec1, gvec2);
    edgeFixture.set_shape(edgeShape);
    const edgeBottom = world.CreateBody(edgeDef);
    edgeBottom.CreateFixture(edgeFixture);

    gvec1.Set(-worldSizeBox2D, worldSizeBox2D);
    gvec2.Set(worldSizeBox2D, worldSizeBox2D);
    edgeShape.SetTwoSided(gvec1, gvec2);
    edgeFixture.set_shape(edgeShape);
    const edgeTop = world.CreateBody(edgeDef);
    edgeTop.CreateFixture(edgeFixture);

    Box2D.destroy(edgeDef);
    Box2D.destroy(edgeShape);
    Box2D.destroy(edgeFixture);
    Box2D.destroy(edgeFilter);

    bodies.push(edgeLeft, edgeRight, edgeBottom, edgeTop);
}

export function step(delta) {
    world.Step(delta, 8, 1);
}

export function createEnemy() {
    const body = world.CreateBody(gdef);
    body.SetLinearDamping(0);
    body.SetType(Box2D.b2_dynamicBody);
    body.SetBullet(false);

    body.setPosition = (x, y) => {
        gvec1.Set(x / Box2DScale, y / Box2DScale);
        body.SetTransform(gvec1, 0);
    };

    body.getPosition = () => {
        const p = body.GetPosition();
        return {
            x: p.x * Box2DScale,
            y: p.y * Box2DScale,
        };
    };

    body.setVelocity = (dx, dy) => {
        gvec1.Set(dx * Box2DSpeed, dy * Box2DSpeed);
        body.SetLinearVelocity(gvec1);
        body.SetAngularVelocity(0);
    };

    body.setSize = size => {
        //const f = body.GetFixtureList();
        //console.log(f);
        //body.DestroyFixture(f);

        gcircle.set_m_radius(size / (2 * Box2DScale));
        gfixture.set_shape(gcircle);
        gfixture.set_density(1);
        gfixture.set_friction(0);
        gfixture.set_restitution(0);
        gfixture.set_isSensor(false);
        gfilter.categoryBits = categoryEnemy;
        gfilter.maskBits = categoryTower | categoryEnemy | categoryProjectile | categoryBoundary;
        gfilter.groupIndex = 0;
        gfixture.set_filter(gfilter);
        body.CreateFixture(gfixture);
    };

    body.destroy = () => {
        world.DestroyBody(body);

        bodies.splice(bodies.indexOf(body), 1);
    };

    bodies.push(body);

    return body;
}

export function createTower(width, height) {
    gpolygon.SetAsBox(width / (2 * Box2DScale), height / (2 * Box2DScale));
    gfixture.set_shape(gpolygon);
    //gcircle.set_m_radius(200 / (2 * Box2DScale));
    //gfixture.set_shape(gcircle);
    gfixture.set_density(1);
    gfixture.set_friction(0);
    gfixture.set_restitution(0);
    gfixture.set_isSensor(false);
    gfilter.categoryBits = categoryTower;
    gfilter.maskBits = categoryTower | categoryEnemy | categoryProjectile | categoryBoundary;
    gfilter.groupIndex = 0;
    gfixture.set_filter(gfilter);
    const body = world.CreateBody(gdef);
    body.CreateFixture(gfixture);
    body.SetLinearDamping(0);
    body.SetType(Box2D.b2_staticBody);
    body.SetBullet(false);

    body.setPosition = (x, y) => {
        gvec1.Set(x / Box2DScale, y / Box2DScale);
        body.SetTransform(gvec1, 0);
    };

    body.getPosition = () => {
        const p = body.GetPosition();
        return {
            x: p.x * Box2DScale,
            y: p.y * Box2DScale,
        };
    };

    body.destroy = () => {
        world.DestroyBody(body);

        bodies.splice(bodies.indexOf(body), 1);
    };

    bodies.push(body);

    return body;
}

export function createPlayer(size) {
    gcircle.set_m_radius(size / (2 * Box2DScale));
    gfixture.set_shape(gcircle);
    gfixture.set_density(1);
    gfixture.set_friction(0);
    gfixture.set_restitution(0);
    gfixture.set_isSensor(false);
    gfilter.categoryBits = categoryTower;
    gfilter.maskBits = categoryTower | categoryEnemy | categoryProjectile | categoryBoundary;
    gfilter.groupIndex = 0;
    gfixture.set_filter(gfilter);
    const body = world.CreateBody(gdef);
    body.CreateFixture(gfixture);
    body.SetLinearDamping(0);
    body.SetType(Box2D.b2_staticBody);
    body.SetBullet(false);

    body.setPosition = (x, y) => {
        gvec1.Set(x / Box2DScale, y / Box2DScale);
        body.SetTransform(gvec1, 0);
    };

    body.getPosition = () => {
        const p = body.GetPosition();
        return {
            x: p.x * Box2DScale,
            y: p.y * Box2DScale,
        };
    };

    body.destroy = () => {
        world.DestroyBody(body);

        bodies.splice(bodies.indexOf(body), 1);
    };

    bodies.push(body);

    return body;
}
