
function heuristic(node, target) {
    // Manhattan distance as heuristic
    return Math.abs(node.x - target.x) + Math.abs(node.y - target.y);
}

function getNeighbors(node, grid) {
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // Up, Right, Down, Left
    const neighbors = [];
    for (const [dx, dy] of directions) {
        const x = node.x + dx;
        const y = node.y + dy;
        if (x >= 0 && x < grid.length && y >= 0 && y < grid[0].length && grid[x][y].nav === 0) {
            neighbors.push({ x, y, g: 0, h: 0, f: 0, parent: null });
        }
    }
    return neighbors;
}

// Grid is a 2D array of numbers. > 1 is a wall.
// The function returns an array of {x, y} objects representing the path.
export function aStar(grid, me, target) {
    const openSet = [];
    const closedSet = [];
    const start = { x: me.x, y: me.y, g: 0, h: heuristic(me, target), f: 0, parent: null };
    start.f = start.g + start.h;
    openSet.push(start);

    while (openSet.length > 0) {
        const current = openSet.sort((a, b) => a.f - b.f)[0];

        if (current.x === target.x && current.y === target.y) {
            // Target reached, construct the path
            const path = [];
            let temp = current;
            while (temp !== null) {
                path.unshift({ x: temp.x, y: temp.y });
                temp = temp.parent;
            }
            return path;
        }

        openSet.splice(openSet.indexOf(current), 1);
        closedSet.push(current);

        const neighbors = getNeighbors(current, grid);
        for (const neighbor of neighbors) {
            if (closedSet.some(closedNode => closedNode.x === neighbor.x && closedNode.y === neighbor.y)) {
                continue; // Already evaluated
            }

            const tentativeGScore = current.g + 1; // Assuming uniform cost

            if (!openSet.some(node => node.x === neighbor.x && node.y === neighbor.y)) {
                openSet.push(neighbor); // Discovered a new node
            } else if (tentativeGScore >= neighbor.g) {
                continue; // This is not a better path
            }

            // This path is the best so far, record it
            neighbor.parent = current;
            neighbor.g = tentativeGScore;
            neighbor.h = heuristic(neighbor, target);
            neighbor.f = neighbor.g + neighbor.h;
        }
    }

    // No path found
    return [];
}

export function turnsOnly(path) {
    if (path.length < 3) return path; // If the path is too short, no turns are made

    const waypoints = [path[0]]; // Always include the start point
    for (let i = 1; i < path.length - 1; i++) {
        const prev = path[i - 1];
        const current = path[i];
        const next = path[i + 1];

        // Determine if a turn is made by comparing directions
        const dirPrev = { x: current.x - prev.x, y: current.y - prev.y };
        const dirNext = { x: next.x - current.x, y: next.y - current.y };

        if (dirPrev.x !== dirNext.x || dirPrev.y !== dirNext.y) {
            // Direction change detected, add to waypoints
            waypoints.push(current);
        }
    }

    waypoints.push(path[path.length - 1]); // Always include the end point
    return waypoints;
}

function hasLineOfSight(grid, start, end) {
    let x0 = start.x;
    let y0 = start.y;
    const x1 = end.x;
    const y1 = end.y;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;

    let err = dx - dy;

    while (x0 !== x1 || y0 !== y1) {
        // Check the current cell for an obstacle
        if (grid[x0][y0].nav > 0) {
            return false; // Obstacle encountered
        }

        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y0 += sy;
        }
    }

    // No obstacles encountered
    return true;
}

export function simplifyPath(grid, fullPath) {
    if (fullPath.length < 3) return fullPath; // If the path is too short, no simplification is needed

    const simplifiedPath = [fullPath[fullPath.length - 1]]; // Start with the target position
    let lastValidIndex = fullPath.length - 1;

    for (let i = fullPath.length - 2; i >= 0; i--) {
        if (!hasLineOfSight(grid, simplifiedPath[simplifiedPath.length - 1], fullPath[i])) {
            // No direct path from last valid waypoint to current, add the next point (i+1) to the path
            simplifiedPath.push(fullPath[lastValidIndex]);
        } else {
            // Update last valid index to current if a direct line of sight exists
            lastValidIndex = i;
        }
    }

    // Ensure the start is included
    if (simplifiedPath[simplifiedPath.length - 1] !== fullPath[0]) {
        simplifiedPath.push(fullPath[0]);
    }

    return simplifiedPath.reverse(); // Reverse to start-to-target order
}
