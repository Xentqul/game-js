//============================================================================
//=========================== ИНИЦИАЛИЗАЦИЯ ИГРЫ =============================
//============================================================================

class Game {
  constructor() {
    this.field = null;
    this.map = [];
    this.hero = { x: 0, y: 0, health: 100, power: 10 };
    this.enemies = [];
    this.swords = [];
    this.potions = [];
    this.tileSize = 27;
    this.mapWidth = 40;
    this.mapHeight = 24;
    this.currentLevel = 1;
    this.enemyInterval = null;
    this.handleKeyPress = null; //  Добавляем ссылку на обработчик
  }

  init() {
    this.field = document.querySelector(".field");
    this.showStartScreen(); // Только показ стартового экрана — игра начнётся по нажатию клавиши
  }

  showStartScreen() {
    const startScreen = document.getElementById("start-screen");
    if (!startScreen) return;

    document.addEventListener(
      "keydown",
      () => {
        startScreen.style.display = "none";
        this.startGame();
      },
      { once: true }
    );
  }

  startGame() {
    this.generateMap();
    this.renderMap();
    this.bindKeys();
    this.startEnemyMovement();
  }

  //============================================================================
  //=========================== ГЕНЕРАЦИЯ МИРА ==================================
  //============================================================================

  generateMap() {
    // Очистка состояния
    this.enemies = [];
    this.swords = [];
    this.potions = [];

    // 1. Заполняем всю карту стенами — как требует ТЗ
    this.map = Array(this.mapHeight)
      .fill()
      .map(() => Array(this.mapWidth).fill("W"));

    // 2. Генерируем вертикальные сквозные проходы (3-5 шт)
    const verticalPassages = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < verticalPassages; i++) {
      const x = Math.floor(Math.random() * this.mapWidth);
      for (let y = 0; y < this.mapHeight; y++) {
        this.map[y][x] = ".";
      }
    }

    // 3. Генерируем горизонтальные сквозные проходы (3-5 шт)
    const horizontalPassages = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < horizontalPassages; i++) {
      const y = Math.floor(Math.random() * this.mapHeight);
      for (let x = 0; x < this.mapWidth; x++) {
        this.map[y][x] = ".";
      }
    }

    // 4. Генерируем комнаты — только если касаются существующих проходов
    const roomCount = Math.floor(Math.random() * 6) + 5;
    const placedRoomsList = [];

    const roomsIntersect = (room1, room2) => {
      return !(
        room1.x + room1.width <= room2.x ||
        room2.x + room2.width <= room1.x ||
        room1.y + room1.height <= room2.y ||
        room2.y + room2.height <= room1.y
      );
    };

    let placedRooms = 0;
    let attempts = 0;
    const maxAttempts = 300;

    while (placedRooms < roomCount && attempts < maxAttempts) {
      attempts++;

      const width = Math.floor(Math.random() * 7) + 4; // 4-10
      const height = Math.floor(Math.random() * 5) + 4; // 4-8

      const startX = Math.floor(Math.random() * (this.mapWidth - width));
      const startY = Math.floor(Math.random() * (this.mapHeight - height));

      if (
        startX < 0 ||
        startY < 0 ||
        startX + width >= this.mapWidth ||
        startY + height >= this.mapHeight
      ) {
        continue;
      }

      let intersects = false;
      for (const placedRoom of placedRoomsList) {
        if (
          roomsIntersect(
            { x: startX, y: startY, width, height },
            {
              x: placedRoom.x,
              y: placedRoom.y,
              width: placedRoom.width,
              height: placedRoom.height,
            }
          )
        ) {
          intersects = true;
          break;
        }
      }
      if (intersects) continue;

      let touchesPath = false;
      for (let dy = -1; dy <= height; dy++) {
        for (let dx = -1; dx <= width; dx++) {
          if (dx >= 0 && dx < width && dy >= 0 && dy < height) continue;
          const checkX = startX + dx;
          const checkY = startY + dy;
          if (
            checkX < 0 ||
            checkX >= this.mapWidth ||
            checkY < 0 ||
            checkY >= this.mapHeight
          )
            continue;
          if (this.map[checkY][checkX] === ".") {
            touchesPath = true;
            break;
          }
        }
        if (touchesPath) break;
      }

      if (!touchesPath) continue;

      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          this.map[startY + dy][startX + dx] = ".";
        }
      }
      placedRooms++;
      placedRoomsList.push({ x: startX, y: startY, width, height });
    }

    // 5. Удаляем изолированные островки
    const reachable = this.getReachablePositions();
    const reachableSet = new Set(reachable.map((pos) => `${pos.x},${pos.y}`));

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        if (this.map[y][x] === "." && !reachableSet.has(`${x},${y}`)) {
          this.map[y][x] = "W";
        }
      }
    }

    // 6. Расставляем предметы и сущности
    this.placeItems();
    this.placeHero();
    this.placeEnemies(); // ← Здесь враги добавляются в пустой массив
    console.log(
      "Уровень",
      this.currentLevel,
      "— врагов размещено:",
      this.enemies.length
    );
  }

  placeItems() {
    for (let i = 0; i < 2; i++) {
      const pos = this.getRandomEmptyPosition();
      if (pos) {
        this.map[pos.y][pos.x] = "SW";
        this.swords.push({ x: pos.x, y: pos.y });
      }
    }

    for (let i = 0; i < 10; i++) {
      const pos = this.getRandomEmptyPosition();
      if (pos) {
        this.map[pos.y][pos.x] = "HP";
        this.potions.push({ x: pos.x, y: pos.y });
      }
    }
  }

  placeHero() {
    const pos = this.getRandomEmptyPosition();
    if (pos) {
      this.hero.x = pos.x;
      this.hero.y = pos.y;
      this.map[pos.y][pos.x] = "P";
    }
  }

  placeEnemies() {
    for (let i = 0; i < 10; i++) {
      const pos = this.getRandomEmptyPosition();
      if (pos) {
        this.enemies.push({ x: pos.x, y: pos.y, health: 50 });
        this.map[pos.y][pos.x] = "E";
      } else {
        console.warn("Не удалось разместить врага", i + 1);
      }
    }
    console.log("Всего врагов размещено:", this.enemies.length);
  }

  getRandomEmptyPosition() {
    const emptyPositions = [];
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        if (this.map[y][x] === ".") {
          emptyPositions.push({ x, y });
        }
      }
    }
    if (emptyPositions.length === 0) return null;
    return emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
  }

  getReachablePositions() {
    const reachable = [];
    const visited = Array(this.mapHeight)
      .fill()
      .map(() => Array(this.mapWidth).fill(false));
    const queue = [];

    const startX = Math.floor(this.mapWidth / 2);
    const startY = Math.floor(this.mapHeight / 2);

    if (this.map[startY][startX] !== ".") {
      outer: for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          if (this.map[y][x] === ".") {
            queue.push({ x, y });
            visited[y][x] = true;
            break outer;
          }
        }
      }
    } else {
      queue.push({ x: startX, y: startY });
      visited[startY][startX] = true;
    }

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      reachable.push({ x: current.x, y: current.y });

      for (const dir of directions) {
        const newX = current.x + dir.dx;
        const newY = current.y + dir.dy;

        if (
          newX >= 0 &&
          newX < this.mapWidth &&
          newY >= 0 &&
          newY < this.mapHeight &&
          !visited[newY][newX] &&
          this.map[newY][newX] === "."
        ) {
          visited[newY][newX] = true;
          queue.push({ x: newX, y: newY });
        }
      }
    }

    return reachable;
  }

  //============================================================================
  //=========================== ОТРИСОВКА ИГРЫ ==================================
  //============================================================================

  renderMap() {
    this.field.innerHTML = "";
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tileType = this.map[y][x];
        const tile = document.createElement("div");
        tile.className = `tile tile${tileType}`;
        tile.style.left = `${x * this.tileSize}px`;
        tile.style.top = `${y * this.tileSize}px`;

        if (tileType === "E" || tileType === "P") {
          const entity =
            tileType === "P"
              ? this.hero
              : this.enemies.find((e) => e.x === x && e.y === y);
          if (entity) {
            const healthBar = document.createElement("div");
            healthBar.className = "health";
            healthBar.style.width = `${entity.health}%`;
            tile.appendChild(healthBar);
          }
        }

        this.field.appendChild(tile);
      }
    }
  }

  //============================================================================
  //=========================== УПРАВЛЕНИЕ ГЕРОЕМ ===============================
  //============================================================================

  bindKeys() {
    // ✅ Удаляем старые обработчики перед добавлением новых
    document.removeEventListener("keydown", this.handleKeyPress);

    // ✅ Сохраняем ссылку на обработчик для последующего удаления
    this.handleKeyPress = (e) => {
      let newX = this.hero.x;
      let newY = this.hero.y;

      switch (e.key.toLowerCase()) {
        case "w":
        case "ц":
          newY--;
          break;
        case "s":
        case "ы":
          newY++;
          break;
        case "a":
        case "ф":
          newX--;
          break;
        case "d":
        case "в":
          newX++;
          break;
        case " ":
          this.attack();
          return;
      }

      if (
        newX < 0 ||
        newX >= this.mapWidth ||
        newY < 0 ||
        newY >= this.mapHeight ||
        this.map[newY][newX] === "W"
      ) {
        return;
      }

      this.moveHero(newX, newY);
      this.checkItemCollision();
      this.enemyAttack();
      this.renderMap();
    };

    document.addEventListener("keydown", this.handleKeyPress);
  }

  moveHero(x, y) {
    this.map[this.hero.y][this.hero.x] = ".";
    this.hero.x = x;
    this.hero.y = y;
    this.map[y][x] = "P";
  }

  //============================================================================
  //=========================== БОЙ И АТАКА =====================================
  //============================================================================

  attack() {
    // Если игра уже завершена (показано сообщение о победе), не выполняем атаку
    if (
      document.getElementById("victory-overlay") ||
      document.querySelector('[style*="background: rgba(0,0,0,0.8)"]')
    ) {
      return;
    }

    // Подсветка атаки
    this.highlightAttackArea();
    setTimeout(() => {
      this.clearAttackHighlight();
    }, 300);

    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ];

    for (const dir of directions) {
      const targetX = this.hero.x + dir.dx;
      const targetY = this.hero.y + dir.dy;

      const enemyIndex = this.enemies.findIndex(
        (e) => e.x === targetX && e.y === targetY
      );
      if (enemyIndex !== -1) {
        this.enemies[enemyIndex].health -= this.hero.power;
        if (this.enemies[enemyIndex].health <= 0) {
          this.map[targetY][targetX] = ".";
          this.enemies.splice(enemyIndex, 1);
        }
      }
    }

    // ✅ ПРОВЕРКА НА ПОБЕДУ - ПЕРВЫЙ УРОВЕНЬ: "ПРОДОЛЖИТЬ", ВТОРОЙ: "ФИНАЛЬНАЯ ПОБЕДА"
    if (this.enemies.length === 0) {
      if (this.currentLevel === 1) {
        this.showVictoryMessage(); // Первая победа - экран "Продолжить"
      } else if (this.currentLevel === 2) {
        this.showFinalVictory(); // Вторая победа - экран финальной победы
      }
    }
  }

  highlightAttackArea() {
    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ];

    for (const dir of directions) {
      const x = this.hero.x + dir.dx;
      const y = this.hero.y + dir.dy;

      if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) continue;

      const tile = this.getTileElement(x, y);
      if (tile) {
        // Создаём оверлей
        const overlay = document.createElement("div");
        overlay.style.position = "absolute";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(255, 0, 0, 0.4)";
        overlay.style.zIndex = "1";
        overlay.className = "attack-overlay"; // Для последующего удаления
        tile.appendChild(overlay);
      }
    }
  }

  clearAttackHighlight() {
    const overlays = document.querySelectorAll(".attack-overlay");
    overlays.forEach((overlay) => overlay.remove());
  }

  getTileElement(x, y) {
    const tiles = document.querySelectorAll(".tile");
    const targetLeft = x * this.tileSize;
    const targetTop = y * this.tileSize;

    for (const tile of tiles) {
      const left = parseInt(tile.style.left);
      const top = parseInt(tile.style.top);

      if (left === targetLeft && top === targetTop) {
        return tile;
      }
    }
    return null;
  }

  checkItemCollision() {
    const swordIndex = this.swords.findIndex(
      (s) => s.x === this.hero.x && s.y === this.hero.y
    );
    if (swordIndex !== -1) {
      this.hero.power += 5;
      this.swords.splice(swordIndex, 1);
      this.map[this.hero.y][this.hero.x] = "P";

      // ✅ Добавляем голубую подсветку для меча
      this.renderMap();

      setTimeout(() => {
        const heroTile = this.getTileElement(this.hero.x, this.hero.y);
        if (heroTile) {
          const overlay = document.createElement("div");
          overlay.style.position = "absolute";
          overlay.style.top = "0";
          overlay.style.left = "0";
          overlay.style.width = "100%";
          overlay.style.height = "100%";
          overlay.style.backgroundColor = "rgba(0, 100, 255, 0.4)"; // Голубой цвет
          overlay.style.zIndex = "10";
          overlay.className = "sword-overlay";
          heroTile.appendChild(overlay);

          setTimeout(() => {
            const swordOverlay = heroTile.querySelector(".sword-overlay");
            if (swordOverlay) swordOverlay.remove();
          }, 500);
        }
      }, 10);
    }

    const potionIndex = this.potions.findIndex(
      (p) => p.x === this.hero.x && p.y === this.hero.y
    );
    if (potionIndex !== -1) {
      this.hero.health = Math.min(100, this.hero.health + 20);
      this.potions.splice(potionIndex, 1);
      this.map[this.hero.y][this.hero.x] = "P";

      // Зеленая подсветка для зелья
      this.renderMap();

      setTimeout(() => {
        const heroTile = this.getTileElement(this.hero.x, this.hero.y);
        if (heroTile) {
          const overlay = document.createElement("div");
          overlay.style.position = "absolute";
          overlay.style.top = "0";
          overlay.style.left = "0";
          overlay.style.width = "100%";
          overlay.style.height = "100%";
          overlay.style.backgroundColor = "rgba(0, 255, 0, 0.4)";
          overlay.style.zIndex = "10";
          overlay.className = "heal-overlay";
          heroTile.appendChild(overlay);

          setTimeout(() => {
            const healOverlay = heroTile.querySelector(".heal-overlay");
            if (healOverlay) healOverlay.remove();
          }, 500);
        }
      }, 10);
    }
  }

  enemyAttack() {
    for (const enemy of this.enemies) {
      const dx = Math.abs(enemy.x - this.hero.x);
      const dy = Math.abs(enemy.y - this.hero.y);
      if (dx <= 1 && dy <= 1 && dx + dy === 1) {
        this.hero.health -= 5;
        if (this.hero.health <= 0) {
          this.showGameOverScreen();
          return;
        }
      }
    }
  }

  //============================================================================
  //=========================== ДВИЖЕНИЕ ВРАГОВ =================================
  //============================================================================

  startEnemyMovement() {
    this.enemyInterval = setInterval(() => {
      // ✅ Если показано сообщение о победе, останавливаем движение
      if (document.getElementById("victory-overlay")) {
        clearInterval(this.enemyInterval);
        return;
      }

      for (let i = 0; i < this.enemies.length; i++) {
        const enemy = this.enemies[i];

        const directions = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
        ];
        const dir = directions[Math.floor(Math.random() * 4)];

        const newX = enemy.x + dir.dx;
        const newY = enemy.y + dir.dy;

        if (
          newX >= 0 &&
          newX < this.mapWidth &&
          newY >= 0 &&
          newY < this.mapHeight &&
          this.map[newY][newX] === "." &&
          !(newX === this.hero.x && newY === this.hero.y)
        ) {
          this.map[enemy.y][enemy.x] = ".";
          enemy.x = newX;
          enemy.y = newY;
          this.map[newY][newX] = "E";
        }
      }
      this.enemyAttack();
      this.renderMap();
    }, 1000);
  }

  //============================================================================
  //=========================== ЭКРАНЫ ИГРЫ =====================================
  //============================================================================

  showGameOverScreen() {
    clearInterval(this.enemyInterval);

    const gameOverDiv = document.createElement("div");
    gameOverDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-family: 'Playfair Display', serif; padding: 20px; text-align: center;">
        <h1 style="font-size: 48px; margin: 0;">ИГРА ОКОНЧЕНА</h1>
        <p style="font-size: 24px; margin: 30px 0; max-width: 800px; line-height: 1.6;">
          Вы сгинули в катакомбах, и революция сорвалась. 
          Король-тиран уничтожил всех участников движения и превратил в ужас жизнь обычных крестьян...
        </p>
        <button onclick="location.reload()" style="padding: 15px 30px; font-size: 20px; background: #ff3333; color: white; border: none; cursor: pointer; border-radius: 5px;">
          Начать заново
        </button>
      </div>
    `;
    document.body.appendChild(gameOverDiv);
  }

  showVictoryMessage() {
    // ✅ Проверяем, не показано ли уже сообщение о победе
    if (document.getElementById("victory-overlay")) {
      return;
    }

    clearInterval(this.enemyInterval);

    const victoryDiv = document.createElement("div");
    victoryDiv.id = "victory-overlay";
    victoryDiv.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-family: 'Playfair Display', serif; padding: 20px; text-align: center;">
      <h2 style="font-size: 32px;">Фух... Их больше, чем мы планировали...</h2>
      <p style="font-size: 24px; margin: 30px 0;">Но я не могу остановиться. Нужно идти дальше...</p>
      <button id="continue-button" style="padding: 15px 30px; font-size: 20px; background: #33aa33; color: white; border: none; cursor: pointer; border-radius: 5px;">
        Продолжить путь
      </button>
    </div>
  `;
    document.body.appendChild(victoryDiv);

    // ✅ Используем делегирование событий
    victoryDiv.addEventListener("click", (e) => {
      if (
        e.target.id === "continue-button" ||
        e.target.closest("#continue-button")
      ) {
        victoryDiv.remove();
        this.startNextLevel();
      }
    });
  }

  startNextLevel() {
    // ✅ Полностью очищаем интервал движения врагов
    if (this.enemyInterval) {
      clearInterval(this.enemyInterval);
      this.enemyInterval = null;
    }

    this.currentLevel++;

    // ✅ Проверяем окончательную победу ДО генерации карты
    if (this.currentLevel > 2) {
      this.showFinalVictory();
      return;
    }

    // ✅ Сбрасываем состояние игры перед генерацией новой карты
    this.enemies = [];
    this.swords = [];
    this.potions = [];

    this.generateMap();
    this.renderMap();
    this.bindKeys();
    this.startEnemyMovement();

    console.log(
      "Начался уровень",
      this.currentLevel,
      "врагов:",
      this.enemies.length
    );
  }

  showFinalVictory() {
    const finalDiv = document.createElement("div");
    finalDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-family: 'Playfair Display', serif; padding: 20px; text-align: center;">
        <h1 style="font-size: 48px; margin: 0;">ВЫ ПОБЕДИЛИ!</h1>
        <p style="font-size: 28px; margin: 30px 0; max-width: 800px; line-height: 1.6;">
          С вашей помощью революционное движение свергло короля-тирана, 
          и солнце вновь воцарилось над мирными землями!
        </p>
        <h2 style="font-size: 36px; margin: 20px 0;">Слава революции, слава Вам!</h2>
        <button onclick="location.reload()" style="padding: 15px 30px; font-size: 20px; background: #33aa33; color: white; border: none; cursor: pointer; border-radius: 5px; margin-top: 30px;">
          Начать заново
        </button>
      </div>
    `;
    document.body.appendChild(finalDiv);
  }
}

//============================================================================
//=========================== ЗАПУСК ИГРЫ =====================================
//============================================================================

var game = new Game();
game.init();
