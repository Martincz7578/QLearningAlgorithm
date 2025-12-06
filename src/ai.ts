const canvas =document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas?.getContext('2d');

const breadcrumbs = document.getElementById('breadcrumbs') as HTMLCanvasElement;
const bctx = breadcrumbs?.getContext('2d');

const movon = document.getElementById('movon') as HTMLInputElement;
const movoff = document.getElementById('movoff') as HTMLInputElement;

let movingTarget = false;
if (movoff) movoff.style.display = 'none';
if (movon) {
    movon.addEventListener('click', () => {
        movingTarget = true;
        movon.style.display = 'none';
        if (movoff) movoff.style.display = 'inline';
    });
}
if (movoff) {
    movoff.addEventListener('click', () => {
        movingTarget = false;
        movoff.style.display = 'none';
        if (movon) movon.style.display = 'inline';
    });
}

let loadedCustomQTable = false;

let maxStepsPerEpisode = 10000;

type action = 'up' | 'down' | 'left' | 'right';

interface ai {
    x: number;
    y: number;
    qTable: Record<action, number>;
}

interface target {
    x: number;
    y: number;
}

interface obstacle {
    x: number;
    y: number;
    punishment: number;
    color?: string;
}

const alpha = 0.1;
const gamma = 0.95;
let epsilon = 1.0;
let lastDistance: number | null = null;

export function distReward(ai: ai, target: target): number {
    const dx = target.x - ai.x;
    const dy = target.y - ai.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if(lastDistance){
        if(lastDistance > distance){
            lastDistance = distance;
            return 5;
        }else{
            lastDistance = distance;
            return -3;
        }
    } else {
        lastDistance = distance;
    }
    return -distance;
}

export function reward(ai: ai, target: target): number {
    if(ai.x === target.x && ai.y === target.y){
        console.log(`Run ${run}. Target reached at (${ai.x}, ${ai.y})! In ${round} steps.`);
        reset();
        return 100;
    }
    return -1;
}

function leavingPunishment(ai: ai): number {
    if(ai.x < 0 || ai.x >= canvas.width / 10 || ai.y < 0 || ai.y >= canvas.height / 10){
        return -100;
    }
    return 0;
}

const exploredPositions = new Set<string>();

function repetitionPunishment(ai: ai): number {
    const posKey = `${ai.x},${ai.y}`;
    if(exploredPositions.has(posKey)){
        return -10;
    }else{
        exploredPositions.add(posKey);
        return 0;
    }
}

export function chooseAction(ai: ai, epsilon: number = 0.1): action {
    if(Math.random() < epsilon) {
        const actions: action[] = ['up', 'down', 'left', 'right'];
        return actions[Math.floor(Math.random() * actions.length)]!;
    }else{
        const sortedEntries = Object.entries(ai.qTable).sort((a, b) => b[1] - a[1]);
        return (sortedEntries[0]?.[0] ?? 'up') as action;
    }
}

function downloadQTable(ai: ai) {
    const json = JSON.stringify(ai.qTable);
    const blob = new Blob([json], {type: 'application/json'});

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = 'qtable.json';
    a.click();
    
    URL.revokeObjectURL(url);
}

let testBot : ai;
let testTarget : target;
let obstacles: obstacle[] = [];

function genObstacles(count: number, color: string = 'red'){
    obstacles = [];
    for(let i = 0; i < count; i++){
        const obs: obstacle = {
            x: Math.floor(Math.random() * canvas.width / 10),
            y: Math.floor(Math.random() * canvas.height / 10),
            punishment: -20
        };
        if(obs.x === testBot.x && obs.y === testBot.y || 
            obs.x === testTarget.x && obs.y === testTarget.y){
            i--;
            continue;
        }
        obstacles.push(obs);
        if(ctx){
            ctx.fillStyle = color;
            ctx.fillRect(obs.x * 10, obs.y * 10, 10, 10);
        }
    }
}

function setup(){
    if(!ctx) return;
    testBot = {x: Math.floor(Math.random() * canvas.width / 10), y: Math.floor(Math.random() * canvas.height / 10), 
        qTable: {'up': 0, 'down': 0, 'left': 0, 'right': 0}};
    testTarget = {x: Math.floor(Math.random() * canvas.width / 10), y: Math.floor(Math.random() * canvas.height / 10)};
    ctx.fillStyle = 'green';
    ctx.fillRect(testTarget.x * 10, testTarget.y * 10, 10, 10);
    genObstacles(20);
}

function checkPos(x: number, y: number): number {
    if(x < 0 || x >= canvas.width / 10 || y < 0 || y >= canvas.height / 10){
        return -20;
    }
    for(const obs of obstacles){
        if(obs.x === x && obs.y === y){
            return obs.punishment;
        }
    }
    return 0;
}

function moveTarget(){
    if(!ctx || !testTarget) return;
    ctx.clearRect(testTarget.x * 10, testTarget.y * 10, 10, 10);
    switch(Math.floor(Math.random() * 4)){
        case 0:
            testTarget.y += (testTarget.y + 1 < canvas.height / 10) && (checkPos(testTarget.x, testTarget.y + 1) === 0) ? 1 : 0;
            break;
        case 1:
            testTarget.y -= (testTarget.y - 1 >= 0) && (checkPos(testTarget.x, testTarget.y - 1) === 0) ? 1 : 0;
            break;
        case 2:
            testTarget.x -= (testTarget.x - 1 >= 0) && (checkPos(testTarget.x - 1, testTarget.y) === 0) ? 1 : 0;
            break;
        case 3:
            testTarget.x += (testTarget.x + 1 < canvas.width / 10) && (checkPos(testTarget.x + 1, testTarget.y) === 0) ? 1 : 0;
            break;
    }
    ctx.fillStyle = 'green';
    ctx.fillRect(testTarget.x * 10, testTarget.y * 10, 10, 10);
}

let round = 0;
let run = 0;
function loop(){
    if (!ctx || !bctx) return;
    ctx.clearRect(testBot.x * 10, testBot.y * 10, 10, 10);
    bctx.fillStyle = 'yellow';
    bctx.fillRect(testBot.x*10-2.5, testBot.y*10-2.5, 5, 5);
    const action = chooseAction(testBot, 0.2);
    let posPun = 0;
    switch(action){
        case 'up':
            if(posPun = checkPos(testBot.x, testBot.y + 1)) break;
            testBot.y += 1;
            break;
        case 'down':
            if(posPun = checkPos(testBot.x, testBot.y - 1)) break;
            testBot.y -= 1;
            break;
        case 'left':
            if(posPun = checkPos(testBot.x - 1, testBot.y)) break;
            testBot.x -= 1;
            break;
        case 'right':
            if(posPun = checkPos(testBot.x + 1, testBot.y)) break;
            testBot.x += 1;
            break;
    }
    if(round >= maxStepsPerEpisode){
        console.log(`Max steps reached without finding target. Resetting...`);
        reset();
    }
    if(movingTarget) moveTarget();
    const r = reward(testBot, testTarget) + distReward(testBot, testTarget) + leavingPunishment(testBot) +
     repetitionPunishment(testBot) + posPun;
    const maxNextQ = Math.max(...Object.values(testBot.qTable));
    testBot.qTable[action] += alpha * (r + gamma * maxNextQ - testBot.qTable[action]);
    epsilon = Math.max(0.05, epsilon * 0.995);
    round++;
    //console.log(`Run ${run}, Step ${round}: Bot at (${testBot.x}, ${testBot.y}), Action: ${action}, Reward: ${r.toFixed(2)}`);
    ctx.fillStyle = 'blue';
    ctx.fillRect(testBot.x * 10, testBot.y * 10, 10, 10);
    posPun = 0;
    requestAnimationFrame(loop);
}

function reset(){
    if(!ctx || !testBot || !bctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    testTarget.x = Math.floor(Math.random() * canvas.width / 10);
    testTarget.y = Math.floor(Math.random() * canvas.height / 10);
    ctx.fillStyle = 'green';
    ctx.fillRect(testTarget.x * 10, testTarget.y * 10, 10, 10);
    round = 0;
    testBot.x = Math.floor(Math.random() * canvas.width / 10);
    testBot.y = Math.floor(Math.random() * canvas.height / 10);
    bctx.clearRect(0, 0, breadcrumbs.width, breadcrumbs.height);
    run++;
    exploredPositions.clear();
    for(const obs of obstacles){
        ctx.clearRect(obs.x * 10, obs.y * 10, 10, 10);
    }
    genObstacles(20 * run);
}

const downloadButton = document.getElementById('download') as HTMLButtonElement;
downloadButton.addEventListener('click', () => {
    if(testBot) {
        downloadQTable(testBot);
    }
});

const button = document.getElementById('startButton') as HTMLButtonElement;
button.addEventListener('click', () => {
    if(!loadedCustomQTable) setup();
    loop();
    button.style.display = 'none';
});

const file = document.getElementById('file') as HTMLInputElement;
file.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if(!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        setup();
        if(!event.target || !testBot) return;
        const content = event.target.result as string;
        const qTable = JSON.parse(content) as Record<action, number>;
        testBot.qTable = qTable;
        console.log('Q-Table loaded:', testBot.qTable);
        loadedCustomQTable = true;
    };
    reader.readAsText(input.files[0]);
});

const ufrom = document.getElementById('UForm') as HTMLFormElement;
const maxInput = document.getElementById('max') as HTMLInputElement;
ufrom.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = parseInt(maxInput.value, 10);
    if (!isNaN(value)) {
        maxStepsPerEpisode = value;
        console.log(`Maximum rounds set to: ${maxStepsPerEpisode}`);
    }
});