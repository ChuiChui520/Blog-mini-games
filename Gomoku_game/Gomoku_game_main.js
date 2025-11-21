// 3D五子棋游戏主逻辑

// 游戏状态
const gameState = {
    boardSize: 15,          // 棋盘大小 (15x15)
    cellSize: 40,           // 每个格子的大小
    currentPlayer: 'black', // 当前玩家 ('black' 或 'white')
    board: Array(15).fill().map(() => Array(15).fill(null)), // 棋盘状态
    gameOver: false,
    winningCells: [],       // 获胜的棋子坐标
    gameMode: null          // 游戏模式: 'single' 或 'multi'
};

// 性能监控
const performanceStats = {
    fps: 0,
    frameCount: 0,
    lastTime: 0
};

// 3D场景相关变量
let scene, camera, renderer, controls;
let boardGroup, piecesGroup;
let raycaster, mouse;

// 初始化Three.js场景
function initScene() {
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 天空蓝背景
    
    // 创建相机
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(250, 350, 250);
    camera.lookAt(0, 0, 0);
    
    // 创建渲染器
    const canvas = document.getElementById('renderer');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    // 添加轨道控制器
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 200;
    controls.maxDistance = 800;
    controls.enablePan = false;
    
    // 创建射线检测器，用于交互
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // 创建光源
    createLights();
    
    // 创建棋盘和棋子组
    boardGroup = new THREE.Group();
    piecesGroup = new THREE.Group();
    scene.add(boardGroup);
    scene.add(piecesGroup);
    
    // 创建3D棋盘
    createBoard();
    
    // 监听窗口大小变化
    window.addEventListener('resize', onWindowResize);
    
    // 监听鼠标事件
    window.addEventListener('click', onMouseClick);
    window.addEventListener('mousemove', onMouseMove);
    
    // 添加FPS显示
    addFPSCounter();
    
    // 开始渲染循环
    animate();
}

// 创建光源
function createLights() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // 方向光（模拟太阳光）
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(500, 500, 500);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 2000;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    scene.add(directionalLight);
    
    // 填充光
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-300, 300, -300);
    scene.add(fillLight);
}

// 创建3D棋盘
function createBoard() {
    const { boardSize, cellSize } = gameState;
    const boardWidth = cellSize * (boardSize - 1);
    const boardHeight = 10; // 棋盘厚度
    
    // 棋盘主体
    const boardGeometry = new THREE.BoxGeometry(boardWidth, boardHeight, boardWidth);
    const boardMaterial = new THREE.MeshStandardMaterial({
        color: 0xDEB887, // 棋盘木色
        roughness: 0.7,
        metalness: 0.2
    });
    const boardMesh = new THREE.Mesh(boardGeometry, boardMaterial);
    boardMesh.position.y = -boardHeight / 2;
    boardMesh.receiveShadow = true;
    boardGroup.add(boardMesh);
    
    // 创建棋盘格子线
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
    const startPos = -boardWidth / 2;
    
    // 横线
    for (let i = 0; i < boardSize; i++) {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(startPos, 0.1, startPos + i * cellSize),
            new THREE.Vector3(startPos + boardWidth, 0.1, startPos + i * cellSize)
        ]);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        boardGroup.add(line);
    }
    
    // 竖线
    for (let i = 0; i < boardSize; i++) {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(startPos + i * cellSize, 0.1, startPos),
            new THREE.Vector3(startPos + i * cellSize, 0.1, startPos + boardWidth)
        ]);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        boardGroup.add(line);
    }
    
    // 添加棋盘标记点（天元和星位）
    const markerPositions = [
        { x: 3, y: 3 }, { x: 3, y: 11 },
        { x: 7, y: 7 }, // 天元
        { x: 11, y: 3 }, { x: 11, y: 11 }
    ];
    
    const markerGeometry = new THREE.CircleGeometry(3, 32);
    const markerMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    
    markerPositions.forEach(pos => {
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(
            startPos + pos.x * cellSize,
            0.2,
            startPos + pos.y * cellSize
        );
        marker.rotation.x = -Math.PI / 2;
        boardGroup.add(marker);
    });
    
    // 添加参考网格
    const gridHelper = new THREE.GridHelper(boardWidth * 1.2, 10);
    gridHelper.position.y = -boardHeight / 2 - 0.1;
    scene.add(gridHelper);
    
    // 创建鼠标悬停预览棋子
    createHoverPreview();
}

// 创建棋子
function createPiece(x, z, color) {
    const radius = gameState.cellSize * 0.4;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    
    // 创建材质
    const material = new THREE.MeshStandardMaterial({
        color: color === 'black' ? 0x000000 : 0xFFFFFF,
        roughness: 0.3,
        metalness: 0.8
    });
    
    // 如果是白子，添加边缘以突出显示
    if (color === 'white') {
        const edgeGeometry = new THREE.SphereGeometry(radius + 0.5, 32, 32);
        const edgeMaterial = new THREE.MeshStandardMaterial({
            color: 0xCCCCCC,
            wireframe: true
        });
        const edgeSphere = new THREE.Mesh(edgeGeometry, edgeMaterial);
        const pieceGroup = new THREE.Group();
        pieceGroup.add(new THREE.Mesh(geometry, material));
        pieceGroup.add(edgeSphere);
        pieceGroup.position.set(x, radius, z);
        pieceGroup.castShadow = true;
        pieceGroup.receiveShadow = true;
        
        // 添加数据属性
        pieceGroup.userData = { x, z, color };
        
        piecesGroup.add(pieceGroup);
        return pieceGroup;
    } else {
        // 黑子直接返回
        const piece = new THREE.Mesh(geometry, material);
        piece.position.set(x, radius, z);
        piece.castShadow = true;
        piece.receiveShadow = true;
        
        // 添加数据属性
        piece.userData = { x, z, color };
        
        piecesGroup.add(piece);
        return piece;
    }
}

// 窗口大小变化处理
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 鼠标移动处理 - 添加悬停预览
function onMouseMove(event) {
    if (gameState.gameOver) return;
    
    // 计算鼠标在归一化设备坐标中的位置 (-1 到 1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // 更新射线检测器
    raycaster.setFromCamera(mouse, camera);
    
    // 计算物体和射线的焦点
    const intersects = raycaster.intersectObjects(boardGroup.children);
    
    if (intersects.length > 0) {
        // 获取最近的交点
        const intersection = intersects[0];
        const point = intersection.point;
        
        // 计算最近的棋盘交叉点
        const { boardSize, cellSize } = gameState;
        const startPos = -cellSize * (boardSize - 1) / 2;
        
        // 计算格子坐标
        let gridX = Math.round((point.x - startPos) / cellSize);
        let gridZ = Math.round((point.z - startPos) / cellSize);
        
        // 检查是否在有效范围内
        if (gridX >= 0 && gridX < boardSize && gridZ >= 0 && gridZ < boardSize) {
            // 更新预览棋子
            updateHoverPreview(gridX, gridZ);
            // 更改鼠标样式
            document.body.style.cursor = !gameState.board[gridX][gridZ] ? 'pointer' : 'default';
            return;
        }
    }
    
    // 如果不在棋盘上，隐藏预览并恢复鼠标样式
    if (hoverPreview) hoverPreview.visible = false;
    previewVisible = false;
    document.body.style.cursor = 'default';
}

// 鼠标点击处理
function onMouseClick(event) {
    if (gameState.gameOver) return;
    
    // 单人模式下，只有黑棋回合（玩家）才能点击
    if (gameState.gameMode === 'single' && gameState.currentPlayer === 'white') {
        return;
    }
    
    // 计算鼠标在归一化设备坐标中的位置 (-1 到 1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // 更新射线检测器
    raycaster.setFromCamera(mouse, camera);
    
    // 计算物体和射线的焦点
    const intersects = raycaster.intersectObjects(boardGroup.children);
    
    if (intersects.length > 0) {
        // 获取最近的交点
        const intersection = intersects[0];
        const point = intersection.point;
        
        // 计算最近的棋盘交叉点
        const { boardSize, cellSize } = gameState;
        const startPos = -cellSize * (boardSize - 1) / 2;
        
        // 计算格子坐标
        let gridX = Math.round((point.x - startPos) / cellSize);
        let gridZ = Math.round((point.z - startPos) / cellSize);
        
        // 检查是否在有效范围内
        if (gridX >= 0 && gridX < boardSize && gridZ >= 0 && gridZ < boardSize) {
            // 检查该位置是否已有棋子
            if (!gameState.board[gridX][gridZ]) {
                // 在网格上放置棋子
                placePiece(gridX, gridZ);
                
                // 单人模式下，玩家下完后AI自动下棋
                if (gameState.gameMode === 'single' && !gameState.gameOver) {
                    setTimeout(aiMove, 500); // 延迟一下，让玩家看到自己的棋子
                }
            }
        }
    }
}

// 鼠标悬停预览棋子
let hoverPreview = null;
let previewVisible = false;

function createHoverPreview() {
    const radius = gameState.cellSize * 0.4;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3
    });
    
    hoverPreview = new THREE.Mesh(geometry, material);
    hoverPreview.visible = false;
    scene.add(hoverPreview);
}

function updateHoverPreview(x, z) {
    if (!hoverPreview || gameState.gameOver) return;
    
    const { boardSize, cellSize } = gameState;
    const startPos = -cellSize * (boardSize - 1) / 2;
    
    // 计算3D坐标
    const worldX = startPos + x * cellSize;
    const worldZ = startPos + z * cellSize;
    
    // 更新预览棋子位置和颜色
    hoverPreview.position.set(worldX, cellSize * 0.4, worldZ);
    hoverPreview.material.color.set(gameState.currentPlayer === 'black' ? 0x000000 : 0xFFFFFF);
    hoverPreview.visible = !gameState.board[x][z];
    previewVisible = hoverPreview.visible;
}

// 放置棋子
function placePiece(x, z) {
    const { boardSize, cellSize, currentPlayer } = gameState;
    const startPos = -cellSize * (boardSize - 1) / 2;
    
    // 计算3D坐标
    const worldX = startPos + x * cellSize;
    const worldZ = startPos + z * cellSize;
    
    // 添加放置棋子的动画效果
    const piece = createPiece(worldX, worldZ, currentPlayer);
    piece.scale.set(0, 0, 0);
    
    // 动画缩放棋子
    const animateScale = (time = 0) => {
        const scale = Math.min(1, time * 3); // 3秒内缩放到正常大小
        piece.scale.set(scale, scale, scale);
        
        if (scale < 1) {
            requestAnimationFrame(() => animateScale(time + 0.016));
        }
    };
    
    animateScale();
    
    // 更新游戏状态
    gameState.board[x][z] = currentPlayer;
    
    // 隐藏预览
    if (hoverPreview) hoverPreview.visible = false;
    previewVisible = false;
    
    // 检查是否获胜
    if (checkWin(x, z)) {
        gameState.gameOver = true;
        document.getElementById('status').textContent = `${currentPlayer === 'black' ? '黑' : '白'}棋获胜！`;
        highlightWinningPieces();
        return;
    }
    
    // 检查是否平局
    if (isBoardFull()) {
        gameState.gameOver = true;
        document.getElementById('status').textContent = '游戏平局！';
        return;
    }
    
    // 切换玩家
    gameState.currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    document.getElementById('status').textContent = `轮到${gameState.currentPlayer === 'black' ? '黑' : '白'}棋`;
}

// 检查是否获胜
function checkWin(x, z) {
    const { board, currentPlayer } = gameState;
    const directions = [
        [1, 0],  // 水平方向
        [0, 1],  // 垂直方向
        [1, 1],  // 对角线方向
        [1, -1]  // 反对角线方向
    ];
    
    for (const [dx, dz] of directions) {
        let count = 1;  // 当前位置已经有一个棋子
        gameState.winningCells = [{x, z}];
        
        // 向正方向检查
        for (let i = 1; i < 5; i++) {
            const nx = x + dx * i;
            const nz = z + dz * i;
            if (nx >= 0 && nx < 15 && nz >= 0 && nz < 15 && board[nx][nz] === currentPlayer) {
                count++;
                gameState.winningCells.push({x: nx, z: nz});
            } else {
                break;
            }
        }
        
        // 向反方向检查
        for (let i = 1; i < 5; i++) {
            const nx = x - dx * i;
            const nz = z - dz * i;
            if (nx >= 0 && nx < 15 && nz >= 0 && nz < 15 && board[nx][nz] === currentPlayer) {
                count++;
                gameState.winningCells.push({x: nx, z: nz});
            } else {
                break;
            }
        }
        
        // 如果有五个连续的棋子
        if (count >= 5) {
            return true;
        }
        
        // 重置获胜单元格列表
        gameState.winningCells = [];
    }
    
    return false;
}

// 高亮显示获胜的棋子
function highlightWinningPieces() {
    const { boardSize, cellSize } = gameState;
    const startPos = -cellSize * (boardSize - 1) / 2;
    
    // 为每个获胜的棋子添加发光效果
    gameState.winningCells.forEach(cell => {
        const worldX = startPos + cell.x * cellSize;
        const worldZ = startPos + cell.z * cellSize;
        
        // 查找对应的棋子
        piecesGroup.children.forEach(piece => {
            if (Math.abs(piece.position.x - worldX) < 1 && Math.abs(piece.position.z - worldZ) < 1) {
                // 创建发光材质
                const glowMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xFFFF00, 
                    transparent: true,
                    opacity: 0.6
                });
                
                // 创建发光效果的球体
                const glowGeometry = new THREE.SphereGeometry(gameState.cellSize * 0.45, 32, 32);
                const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
                glowMesh.position.copy(piece.position);
                
                // 将发光效果添加到场景中
                piecesGroup.add(glowMesh);
                
                // 闪烁动画
                animateGlow(glowMesh);
            }
        });
    });
}

// 发光动画
function animateGlow(mesh) {
    let opacity = 0.6;
    let increasing = false;
    
    function updateOpacity() {
        if (!mesh.parent) return;
        
        if (increasing) {
            opacity += 0.02;
            if (opacity >= 0.6) increasing = false;
        } else {
            opacity -= 0.02;
            if (opacity <= 0.2) increasing = true;
        }
        
        mesh.material.opacity = opacity;
        requestAnimationFrame(updateOpacity);
    }
    
    updateOpacity();
}

// 检查棋盘是否已满
function isBoardFull() {
    for (let i = 0; i < 15; i++) {
        for (let j = 0; j < 15; j++) {
            if (!gameState.board[i][j]) {
                return false;
            }
        }
    }
    return true;
}

// 添加FPS计数器
function addFPSCounter() {
    const fpsDiv = document.createElement('div');
    fpsDiv.id = 'fpsCounter';
    fpsDiv.style.position = 'absolute';
    fpsDiv.style.top = '10px';
    fpsDiv.style.right = '10px';
    fpsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    fpsDiv.style.color = 'white';
    fpsDiv.style.padding = '5px 10px';
    fpsDiv.style.borderRadius = '4px';
    fpsDiv.style.fontFamily = 'monospace';
    fpsDiv.style.zIndex = '100';
    document.body.appendChild(fpsDiv);
}

function updateFPSCounter() {
    const now = performance.now();
    performanceStats.frameCount++;
    
    if (now - performanceStats.lastTime >= 1000) {
        performanceStats.fps = performanceStats.frameCount;
        performanceStats.frameCount = 0;
        performanceStats.lastTime = now;
        
        const fpsDiv = document.getElementById('fpsCounter');
        if (fpsDiv) {
            fpsDiv.textContent = `FPS: ${performanceStats.fps}`;
        }
    }
}

// 重置游戏
function resetGame() {
    // 添加重置动画效果
    scene.traverse(object => {
        if (object.userData && (object.userData.x !== undefined || object.parent?.userData?.x !== undefined)) {
            // 创建淡出动画
            const animateOut = (opacity = 1) => {
                if (!object.parent) return;
                
                opacity -= 0.05;
                if (object.material) object.material.opacity = opacity;
                
                if (opacity > 0) {
                    requestAnimationFrame(() => animateOut(opacity));
                } else {
                    // 移除完全透明的对象
                    if (piecesGroup.contains(object)) {
                        piecesGroup.remove(object);
                    }
                }
            };
            
            // 开始淡出动画
            if (object.material) {
                object.material.transparent = true;
                animateOut();
            }
        }
    });
    
    // 延迟重置游戏状态，等待动画完成
    setTimeout(() => {
        // 确保所有棋子都被移除
        while (piecesGroup.children.length > 0) {
            const piece = piecesGroup.children[0];
            piecesGroup.remove(piece);
        }
        
        // 重置游戏状态
        gameState.board = Array(15).fill().map(() => Array(15).fill(null));
        gameState.currentPlayer = 'black';
        gameState.gameOver = false;
        gameState.winningCells = [];
        
        // 更新状态显示
        document.getElementById('status').textContent = '轮到黑棋';
        
        // 隐藏预览
        if (hoverPreview) hoverPreview.visible = false;
        previewVisible = false;
    }, 300);
}

// 切换视角旋转
let isRotating = false;
let rotationAngle = 0;

function toggleRotation() {
    isRotating = !isRotating;
    const rotateBtn = document.getElementById('rotateBtn');
    rotateBtn.textContent = isRotating ? '停止旋转' : '旋转视角';
}

// 动画循环
function animate() {
    requestAnimationFrame(animate);
    
    // 更新性能统计
    updateFPSCounter();
    
    // 更新控制器
    controls.update();
    
    // 如果启用了自动旋转，更新视角
    if (isRotating) {
        rotationAngle += 0.005;
        const radius = 400;
        camera.position.x = Math.sin(rotationAngle) * radius;
        camera.position.z = Math.cos(rotationAngle) * radius;
        camera.lookAt(0, 0, 0);
    }
    
    // 渲染场景
    renderer.render(scene, camera);
}

// 开始游戏
function startGame(mode) {
    // 设置游戏模式
    gameState.gameMode = mode;
    
    // 更新游戏模式显示
    document.getElementById('gameMode').textContent = mode === 'single' ? '单人游戏模式' : '多人游戏模式';
    
    // 显示游戏容器，隐藏主菜单
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    // 重置游戏
    resetGame();
}

// 返回主菜单
function backToMenu() {
    // 隐藏游戏容器，显示主菜单
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    
    // 重置游戏状态
    gameState.gameMode = null;
    resetGame();
}

// AI移动函数
function aiMove() {
    if (gameState.gameOver || gameState.currentPlayer !== 'white') return;
    
    // 查找最佳落子位置
    const bestMove = findBestMove();
    
    if (bestMove) {
        // AI下棋
        placePiece(bestMove.x, bestMove.z);
    }
}

// 查找最佳落子位置（优化的AI策略）
function findBestMove() {
    const { board, boardSize } = gameState;
    let bestScore = -Infinity;
    let bestMove = null;
    
    // 只评估有棋子附近的位置和中心区域，减少计算量
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j < boardSize; j++) {
            if (!board[i][j] && (checkNearPieces(i, j) || isInCenterArea(i, j))) {
                // 计算这个位置的评分
                const score = evaluateMove(i, j);
                
                // 更新最佳位置
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { x: i, z: j };
                }
            }
        }
    }
    
    // 如果没有找到合适的位置（通常是游戏开始时），选择中心位置
    if (!bestMove) {
        return { x: 7, z: 7 }; // 默认选择天元位置
    }
    
    return bestMove;
}

// 评估一个落子位置的价值
function evaluateMove(x, z) {
    const { board } = gameState;
    let score = 0;
    
    // 模拟AI（白棋）落子
    board[x][z] = 'white';
    // 评估AI的进攻价值
    score += evaluatePosition(x, z, 'white') * 1.2; // AI进攻稍微优先于防守
    // 恢复棋盘
    board[x][z] = null;
    
    // 模拟玩家（黑棋）落子
    board[x][z] = 'black';
    // 评估防守价值
    score += evaluatePosition(x, z, 'black');
    // 恢复棋盘
    board[x][z] = null;
    
    // 位置加成（中心位置更好）
    const centerDist = Math.sqrt(
        Math.pow(x - 7, 2) + Math.pow(z - 7, 2)
    );
    const positionBonus = 100 / (centerDist + 1);
    score += positionBonus;
    
    return score;
}

// 评估某个位置对于特定玩家的价值
function evaluatePosition(x, z, player) {
    const directions = [
        [1, 0],  // 水平方向
        [0, 1],  // 垂直方向
        [1, 1],  // 对角线方向
        [1, -1]  // 反对角线方向
    ];
    
    let maxScore = 0;
    
    for (const [dx, dz] of directions) {
        const pattern = analyzePattern(x, z, dx, dz, player);
        const patternScore = getPatternScore(pattern, player);
        maxScore = Math.max(maxScore, patternScore);
    }
    
    return maxScore;
}

// 分析某个位置在某个方向上的棋型
function analyzePattern(x, z, dx, dz, player) {
    const { board, boardSize } = gameState;
    let pattern = {
        length: 1,  // 当前连续棋子长度
        openEnds: 0,  // 开放端数量
        blocked: false  // 是否被对方棋子阻挡
    };
    
    // 检查两个方向
    for (let dir of [1, -1]) {
        let count = 0;
        let blocked = false;
        
        for (let i = 1; i <= 4; i++) {  // 最多检查4步
            const nx = x + dx * i * dir;
            const nz = z + dz * i * dir;
            
            if (nx < 0 || nx >= boardSize || nz < 0 || nz >= boardSize) {
                blocked = true;
                break;
            }
            
            if (board[nx][nz] === player) {
                count++;
            } else if (board[nx][nz] === null) {
                // 空位置，该方向是开放的
                break;
            } else {
                // 对方棋子，该方向被阻挡
                blocked = true;
                pattern.blocked = true;
                break;
            }
        }
        
        pattern.length += count;
        
        if (!blocked) {
            pattern.openEnds++;
        }
    }
    
    return pattern;
}

// 根据棋型获取分数
function getPatternScore(pattern, player) {
    const { length, openEnds, blocked } = pattern;
    
    // 连五（已赢）
    if (length >= 5) {
        return 100000;
    }
    
    // 活四（两端开放的四个连续棋子）
    if (length === 4 && openEnds === 2) {
        return 10000;
    }
    
    // 冲四（一端开放的四个连续棋子，或中间有空格的情况）
    if (length === 4 && openEnds === 1) {
        return 1000;
    }
    
    // 活三（两端开放的三个连续棋子）
    if (length === 3 && openEnds === 2) {
        return 1000;
    }
    
    // 冲三（一端开放的三个连续棋子）
    if (length === 3 && openEnds === 1) {
        return 100;
    }
    
    // 活二（两端开放的两个连续棋子）
    if (length === 2 && openEnds === 2) {
        return 50;
    }
    
    // 冲二（一端开放的两个连续棋子）
    if (length === 2 && openEnds === 1) {
        return 10;
    }
    
    // 单棋（一个棋子）
    if (length === 1) {
        return 1;
    }
    
    return 0;
}

// 检查位置是否在中心区域
function isInCenterArea(x, z) {
    const centerX = 7;
    const centerZ = 7;
    const radius = 5;
    
    return Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(z - centerZ, 2)
    ) <= radius;
}

// AI专用的获胜检查函数（不修改gameState）
function checkWinForAI(x, z, player) {
    const { board, boardSize } = gameState;
    const directions = [
        [1, 0],  // 水平方向
        [0, 1],  // 垂直方向
        [1, 1],  // 对角线方向
        [1, -1]  // 反对角线方向
    ];
    
    for (const [dx, dz] of directions) {
        let count = 1;  // 当前位置已经有一个棋子
        
        // 向正方向检查
        for (let i = 1; i < 5; i++) {
            const nx = x + dx * i;
            const nz = z + dz * i;
            if (nx >= 0 && nx < boardSize && nz >= 0 && nz < boardSize && board[nx][nz] === player) {
                count++;
            } else {
                break;
            }
        }
        
        // 向反方向检查
        for (let i = 1; i < 5; i++) {
            const nx = x - dx * i;
            const nz = z - dz * i;
            if (nx >= 0 && nx < boardSize && nz >= 0 && nz < boardSize && board[nx][nz] === player) {
                count++;
            } else {
                break;
            }
        }
        
        // 如果有五个连续的棋子
        if (count >= 5) {
            return true;
        }
    }
    
    return false;
}

// 检查指定位置附近是否有棋子
function checkNearPieces(x, z) {
    const { board, boardSize } = gameState;
    for (let i = x - 2; i <= x + 2; i++) {
        for (let j = z - 2; j <= z + 2; j++) {
            if (i >= 0 && i < boardSize && j >= 0 && j < boardSize) {
                if (board[i][j]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// 初始化事件监听器
function initEventListeners() {
    // 游戏控制按钮
    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.getElementById('rotateBtn').addEventListener('click', toggleRotation);
    document.getElementById('backToMenuBtn').addEventListener('click', backToMenu);
    
    // 主菜单按钮
    document.getElementById('singlePlayerBtn').addEventListener('click', () => startGame('single'));
    document.getElementById('multiPlayerBtn').addEventListener('click', () => startGame('multi'));
}

// 游戏初始化
function init() {
    initScene();
    initEventListeners();
}

// 当页面加载完成后初始化游戏
window.addEventListener('load', init);