class Game {
  constructor() {
    this.field = null;
    this.inventorySlots = 5;
    this.inventory = Array(this.inventorySlots).fill(null);
    this.selectedInventoryIndex = 0;
    this.map = [];
    this.hero = { x: 0, y: 0, health: 100, power: 10, swords: 0 };
    this.enemies = [];
    this.swords = [];
    this.potions = [];
    this.tileSize = 27;
    this.mapWidth = 40;
    this.mapHeight = 24;
    this.currentLevel = 1;
    this.enemyInterval = null;
    this.handleKeyPress = null;
    this.boss = null;

    // Музыка
    this.music = {
      menu: null,
      pickup: null,
      fight: null,
      nextLevel: null,
      died: null,
      end: null,
    };
    this.currentTrack = null;
    this.musicEnabled = false;
    this.musicQueue = null;
  }

  // ============================================================================
  // =========================== ИНИЦИАЛИЗАЦИЯ ИГРЫ =============================
  // ============================================================================

  init() {
    this.field = document.querySelector(".field");
    this.inventory = document.querySelector(".inventory");
    this.initMusic(); // Просто создаем аудио-объекты
    this.showStartScreen(); // Вся логика запуска здесь
    this.updateInventory();
  }

  // ============================================================================
  // =========================== МУЗЫКАЛЬНАЯ СИСТЕМА ============================
  // ============================================================================

  initMusic() {
    this.music.menu = new Audio("music/main-menu.mp3");
    this.music.pickup = new Audio("music/pick-smth.mp3");
    this.music.fight = new Audio("music/fight.mp3");
    this.music.nextLevel = new Audio("music/next-level.mp3");
    this.music.died = new Audio("music/died.mp3");
    this.music.end = new Audio("music/end.mp3");

    this.music.menu.loop = true;
    this.music.pickup.loop = false;
    this.music.fight.loop = true;
    this.music.nextLevel.loop = false;
    this.music.died.loop = false;
    this.music.end.loop = false;

    this.music.menu.volume = 0.7;
    this.music.pickup.volume = 0.9;
    this.music.fight.volume = 0.6;
    this.music.nextLevel.volume = 0.7;
    this.music.died.volume = 0.7;
    this.music.end.volume = 0.7;
  }

  playMusic(trackName) {
    // Если музыка еще не разблокирована, ставим в очередь
    if (!this.musicEnabled) {
      this.musicQueue = trackName;
      return;
    }

    // Для звука подбора предмета не останавливаем другую музыку
    if (trackName === "pickup") {
      // Создаем копию аудио для одновременного воспроизведения
      const pickupSound = this.music.pickup.cloneNode();
      pickupSound.volume = 0.9;
      pickupSound.play();
      return;
    }

    // Останавливаем ВСЮ музыку перед запуском новой
    this.stopMusic();

    // Воспроизводим новый трек
    this.currentTrack = this.music[trackName];
    if (this.currentTrack) {
      const playPromise = this.currentTrack.play();

      // Если воспроизведение не удалось, ждем взаимодействия пользователя
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log(
            "Автовоспроизведение заблокировано, ждем взаимодействия:",
            error
          );
          this.musicEnabled = false;
          this.musicQueue = trackName;
        });
      }
    }
  }

  stopMusic() {
    // Останавливаем ВСЕ треки, кроме звуков подбора
    for (const trackName in this.music) {
      if (this.music.hasOwnProperty(trackName) && trackName !== "pickup") {
        const track = this.music[trackName];
        track.pause();
        track.currentTime = 0; // Перематываем на начало
      }
    }
    this.currentTrack = null; // Сбрасываем текущий трек
  }

  // ============================================================================
  // =========================== ЭКРАНЫ ИГРЫ ====================================
  // ============================================================================

  showStartScreen() {
    const startScreen = document.getElementById("start-screen");
    if (!startScreen) return;

    // Создаем кнопку для включения музыки
    const enableMusicButton = document.createElement("button");
    enableMusicButton.textContent = "Включить музыку";
    enableMusicButton.style.cssText = `
    padding: 15px 30px;
    font-size: 20px;
    background: #33aa33;
    color: white;
    border: none;
    cursor: pointer;
    border-radius: 5px;
    margin-top: 20px;
  `;

    // Добавляем кнопку на экран
    startScreen.appendChild(enableMusicButton);

    let musicEnabledByButton = false;

    // Обработчик для кнопки включения музыки
    enableMusicButton.addEventListener("click", () => {
      if (!musicEnabledByButton) {
        // === ВСЯ ЛОГИКА РАЗБЛОКИРОВКИ МУЗЫКИ ТЕПЕРЬ ЗДЕСЬ ===
        this.musicEnabled = true;
        musicEnabledByButton = true;

        // Пытаемся воспроизвести музыку меню
        this.playMusic("menu")
          .then(() => {
            // Если удалось, меняем кнопку
            enableMusicButton.textContent = "Музыка включена!";
            enableMusicButton.style.background = "#555";
          })
          .catch((error) => {
            // Если не удалось (блокировка браузера), оставляем кнопку активной
            console.error("Не удалось воспроизвести музыку:", error);
            this.musicEnabled = false;
            musicEnabledByButton = false;
          });

        // Показываем сообщение о том, что нужно нажать любую клавишу
        const message = document.createElement("p");
        message.textContent = "Нажмите любую клавишу для начала игры";
        message.style.cssText = `
        color: white;
        font-size: 18px;
        margin-top: 20px;
      `;
        startScreen.appendChild(message);
      }
    });

    // Обработчик для любой клавиши клавиатуры
    const keyHandler = (e) => {
      // Игнорируем клики мыши
      if (e.type === "click") return;

      // Начинаем игру только если музыка была включена через кнопку
      if (musicEnabledByButton) {
        startScreen.style.display = "none";
        document.removeEventListener("keydown", keyHandler);
        this.stopMusic(); // Останавливаем музыку меню
        this.startGame(); // Запускаем игру и музыку боя
      }
    };

    document.addEventListener("keydown", keyHandler);
  }

  startGame() {
    this.generateMap();
    this.renderMap();
    this.bindKeys();
    this.startEnemyMovement();
    this.playMusic("fight"); // stopMusic() вызовется внутри playMusic
  }

  showGameOverScreen() {
    clearInterval(this.enemyInterval);
    this.stopMusic();
    this.playMusic("died");

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
    if (document.getElementById("victory-overlay")) return;

    clearInterval(this.enemyInterval);
    this.stopMusic();
    this.playMusic("nextLevel");

    let message = "";
    let buttonText = "";

    if (this.currentLevel === 1) {
      message = `
        <h2 style="font-size: 32px;">Фух... Их больше, чем мы планировали...</h2>
        <p style="font-size: 24px; margin: 30px 0;">Но я не могу остановиться. Нужно идть дальше...</p>
      `;
      buttonText = "Продолжить путь";
    } else if (this.currentLevel === 2) {
      message = `
        <h2 style="font-size: 32px;">Знакомая планировка... Я уже близко.</h2>
        <p style="font-size: 24px; margin: 20px 0;">Где-то тут должен быть скрытый проход в подвал замка...</p>
        <p style="font-size: 24px; margin: 20px 0;">Кто это? Что!? Охрана! Меня заметили!</p>
        <p style="font-size: 24px; margin: 20px 0; font-style:italic;">Уничтожьте всех оставшихся врагов, а после сразитесь с элитной охраной дворца и свергните короля</p>
      `;
      buttonText = "В бой!";
    }

    const victoryDiv = document.createElement("div");
    victoryDiv.id = "victory-overlay";
    victoryDiv.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-family: 'Playfair Display', serif; padding: 20px; text-align: center;">
      ${message}
      <button id="continue-button" style="padding: 15px 30px; font-size: 20px; background: #33aa33; color: white; border: none; cursor: pointer; border-radius: 5px;">
        ${buttonText}
      </button>
    </div>
  `;
    document.body.appendChild(victoryDiv);

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

  showFinalVictory() {
    this.stopMusic();
    this.playMusic("end");

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

  // ============================================================================
  // =========================== ГЕНЕРАЦИЯ МИРА =================================
  // ============================================================================

  generateMap() {
    this.enemies = [];
    this.swords = [];
    this.potions = [];
    this.boss = null;

    this.map = Array(this.mapHeight)
      .fill()
      .map(() => Array(this.mapWidth).fill("W"));

    // Вертикальные проходы
    const verticalPassages = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < verticalPassages; i++) {
      const x = Math.floor(Math.random() * this.mapWidth);
      for (let y = 0; y < this.mapHeight; y++) {
        this.map[y][x] = ".";
      }
    }

    // Горизонтальные проходы
    const horizontalPassages = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < horizontalPassages; i++) {
      const y = Math.floor(Math.random() * this.mapHeight);
      for (let x = 0; x < this.mapWidth; x++) {
        this.map[y][x] = ".";
      }
    }

    // Генерация комнат
    const roomCount = Math.floor(Math.random() * 6) + 5;
    const placedRoomsList = [];
    let placedRooms = 0;
    let attempts = 0;
    const maxAttempts = 300;

    const roomsIntersect = (room1, room2) => {
      return !(
        room1.x + room1.width <= room2.x ||
        room2.x + room2.width <= room1.x ||
        room1.y + room1.height <= room2.y ||
        room2.y + room2.height <= room1.y
      );
    };

    while (placedRooms < roomCount && attempts < maxAttempts) {
      attempts++;
      const width = Math.floor(Math.random() * 7) + 4;
      const height = Math.floor(Math.random() * 5) + 4;
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
          roomsIntersect({ x: startX, y: startY, width, height }, placedRoom)
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

    // Удаление изолированных областей
    const reachable = this.getReachablePositions();
    const reachableSet = new Set(reachable.map((pos) => `${pos.x},${pos.y}`));
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        if (this.map[y][x] === "." && !reachableSet.has(`${x},${y}`)) {
          this.map[y][x] = "W";
        }
      }
    }

    this.placeItems();
    this.placeHero();
    this.placeEnemies();
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
    const enemyCount = this.currentLevel === 3 ? 15 : 10;
    const enemyHealth = this.currentLevel === 3 ? 70 : 50;

    for (let i = 0; i < enemyCount; i++) {
      const pos = this.getRandomEmptyPosition();
      if (pos) {
        this.enemies.push({ x: pos.x, y: pos.y, health: enemyHealth });
        this.map[pos.y][pos.x] = "E";
      }
    }

    // Босс на третьем уровне
    if (this.currentLevel === 3) {
      const bossPos = this.getRandomEmptyPosition();
      if (bossPos) {
        this.boss = {
          x: bossPos.x,
          y: bossPos.y,
          health: 200,
          power: 20,
          isBoss: true,
        };
        this.map[bossPos.y][bossPos.x] = "P";
      }
    }
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
    return emptyPositions.length === 0
      ? null
      : emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
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
      reachable.push(current);

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

  // ============================================================================
  // =========================== ОТРИСОВКА ======================================
  // ============================================================================

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
          let entity;
          if (tileType === "P") {
            if (this.boss && this.boss.x === x && this.boss.y === y) {
              entity = this.boss;
            } else if (this.hero.x === x && this.hero.y === y) {
              entity = this.hero;
            }
          } else {
            entity = this.enemies.find((e) => e.x === x && e.y === y);
          }

          if (entity) {
            const healthBar = document.createElement("div");
            healthBar.className = entity.isBoss ? "boss-health" : "health";
            healthBar.style.width = `${entity.health}%`;
            tile.appendChild(healthBar);
          }
        }

        this.field.appendChild(tile);
      }
    }
  }

  // ============================================================================
  // =========================== УПРАВЛЕНИЕ =====================================
  // ============================================================================

  bindKeys() {
    document.removeEventListener("keydown", this.handleKeyPress);

    this.handleKeyPress = (e) => {
      const key = e.key.toLowerCase();
      
      // Обработка движения и атаки
      switch (key) {
        case "w":
        case "ц":
          this.moveHero(this.hero.x, this.hero.y - 1);
          break;
        case "s":
        case "ы":
          this.moveHero(this.hero.x, this.hero.y + 1);
          break;
        case "a":
        case "ф":
          this.moveHero(this.hero.x - 1, this.hero.y);
          break;
        case "d":
        case "в":
          this.moveHero(this.hero.x + 1, this.hero.y);
          break;
        case " ":
          this.attack();
          return;
        case "e":
        case "у":
          this.useInventoryItem();
          return;
        case "t":
        case "е":
          this.showDeleteConfirmation();
          return;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          this.selectInventorySlot(parseInt(key) - 1);
          return;
        case "arrowleft":
          this.selectInventorySlot((this.selectedInventoryIndex - 1 + this.inventorySlots) % this.inventorySlots);
          return;
        case "arrowright":
          this.selectInventorySlot((this.selectedInventoryIndex + 1) % this.inventorySlots);
          return;
      }

      this.checkItemCollision();
      this.enemyAttack();
      this.renderMap();
    };

    document.addEventListener("keydown", this.handleKeyPress);
  }

  // Использование предмета из инвентаря
  useInventoryItem() {
    const item = this.inventory[this.selectedInventoryIndex];
    
    if (item && item.type === "potion") {
      if (this.hero.health < 100) {
        this.hero.health = Math.min(100, this.hero.health + 20);
        this.inventory[this.selectedInventoryIndex] = null;
        this.updateInventory();
        this.showItemEffect("heal");
      }
    }
  }

  // Выбор слота инвентаря
  selectInventorySlot(index) {
    this.selectedInventoryIndex = index;
    this.updateInventory();
  }

  moveHero(x, y) {
    // Проверяем, находится ли новая позиция в пределах карты
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
      return; // Не позволяем выйти за границы
    }
    
    // Проверяем, является ли новая позиция проходимой
    if (this.map[y][x] !== "." && this.map[y][x] !== "SW" && this.map[y][x] !== "HP") {
      return; // Не позволяем ходить через стены и врагов
    }
    
    this.map[this.hero.y][this.hero.x] = ".";
    this.hero.x = x;
    this.hero.y = y;
    this.map[y][x] = "P";
  }

  // ============================================================================
  // =========================== БОЙ И АТАКА ====================================
  // ============================================================================

  attack() {
    if (document.getElementById("victory-overlay")) return;

    this.highlightAttackArea();
    setTimeout(() => this.clearAttackHighlight(), 300);

    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ];

    for (const dir of directions) {
      const targetX = this.hero.x + dir.dx;
      const targetY = this.hero.y + dir.dy;

      // Проверяем, находится ли цель в пределах карты
      if (targetX < 0 || targetX >= this.mapWidth || targetY < 0 || targetY >= this.mapHeight) {
        continue;
      }

      // Атака врагов
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

      // Атака босса
      if (
        this.currentLevel === 3 &&
        this.boss &&
        this.boss.x === targetX &&
        this.boss.y === targetY
      ) {
        this.boss.health -= this.hero.power;
        if (this.boss.health <= 0) {
          this.map[targetY][targetX] = ".";
          this.boss = null;
        }
      }
    }

    // Проверка победы
    const allEnemiesDefeated =
      this.enemies.length === 0 &&
      (this.currentLevel !== 3 || this.boss === null);
    if (allEnemiesDefeated) {
      if (this.currentLevel === 1 || this.currentLevel === 2) {
        this.showVictoryMessage();
      } else if (this.currentLevel === 3) {
        this.showFinalVictory();
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
        const overlay = document.createElement("div");
        overlay.style.position = "absolute";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(255, 0, 0, 0.4)";
        overlay.style.zIndex = "1";
        overlay.className = "attack-overlay";
        tile.appendChild(overlay);
      }
    }
  }

  clearAttackHighlight() {
    document
      .querySelectorAll(".attack-overlay")
      .forEach((overlay) => overlay.remove());
  }

  getTileElement(x, y) {
    const tiles = document.querySelectorAll(".tile");
    const targetLeft = x * this.tileSize;
    const targetTop = y * this.tileSize;

    for (const tile of tiles) {
      const left = parseInt(tile.style.left);
      const top = parseInt(tile.style.top);
      if (left === targetLeft && top === targetTop) return tile;
    }
    return null;
  }

  enemyAttack() {
    // Атака врагов
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

    // Атака босса
    if (this.currentLevel === 3 && this.boss) {
      const dx = Math.abs(this.boss.x - this.hero.x);
      const dy = Math.abs(this.boss.y - this.hero.y);
      if (dx <= 1 && dy <= 1 && dx + dy === 1) {
        this.hero.health -= 10;
        if (this.hero.health <= 0) {
          this.showGameOverScreen();
          return;
        }
      }
    }
  }

  // ============================================================================
  // =========================== ПРЕДМЕТЫ И ИНВЕНТАРЬ ===========================
  // ============================================================================

  // Добавляем метод для добавления в инвентарь
  addToInventory(itemType) {
    // Ищем пустой слот
    for (let i = 0; i < this.inventorySlots; i++) {
      if (this.inventory[i] === null) {
        this.inventory[i] = { type: itemType };
        this.updateInventory();
        return true;
      }
    }
    return false; // Инвентарь полон
  }

  // Обновляем метод проверки столкновения с зельем
  checkItemCollision() {
    // Мечи (оставляем как было)
    const swordIndex = this.swords.findIndex(
      (s) => s.x === this.hero.x && s.y === this.hero.y
    );
    if (swordIndex !== -1 && this.hero.swords < 4) {
      this.hero.swords++;
      this.hero.power += 5;
      this.swords.splice(swordIndex, 1);
      this.map[this.hero.y][this.hero.x] = "P";
      this.updateInventory();
      this.showItemEffect("sword");
      this.playMusic("pickup");
    }

    // Зелья (новая логика)
    const potionIndex = this.potions.findIndex(
      (p) => p.x === this.hero.x && p.y === this.hero.y
    );
    if (potionIndex !== -1) {
      this.playMusic("pickup"); // Звук подбора
      
      if (this.hero.health >= 100) {
        // Здоровье полное - добавляем в инвентарь
        const added = this.addToInventory("potion");
        if (!added) {
          // Если инвентарь полон, используем сразу
          this.hero.health = Math.min(100, this.hero.health + 20);
          this.showItemEffect("heal");
        }
      } else {
        // Здоровье не полное - используем сразу
        this.hero.health = Math.min(100, this.hero.health + 20);
        this.showItemEffect("heal");
      }
      
      this.potions.splice(potionIndex, 1);
      this.map[this.hero.y][this.hero.x] = "P";
    }
  }

  showItemEffect(type) {
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
        overlay.style.zIndex = "10";
        overlay.className = `${type}-overlay`;

        if (type === "sword") {
          overlay.style.backgroundColor = "rgba(0, 100, 255, 0.4)";
        } else {
          overlay.style.backgroundColor = "rgba(0, 255, 0, 0.4)";
        }

        heroTile.appendChild(overlay);
        setTimeout(() => overlay.remove(), 500);
      }
    }, 10);
  }

  // Показать подтверждение удаления
showDeleteConfirmation() {
  const item = this.inventory[this.selectedInventoryIndex];
  if (!item) return;

  // Создаем overlay подтверждения
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    padding: 20px;
    border: 2px solid red;
    border-radius: 10px;
    z-index: 1000;
    color: white;
    text-align: center;
  `;

  overlay.innerHTML = `
    <p>Вы уверены, что хотите выбросить предмет?</p>
    <p>Он пропадет безвозвратно!</p>
    <div style="margin-top: 15px;">
      <button id="confirm-delete-yes" style="margin-right: 10px; padding: 5px 15px;">Да</button>
      <button id="confirm-delete-no" style="padding: 5px 15px;">Нет</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Обработчики кнопок
  document.getElementById("confirm-delete-yes").onclick = () => {
    this.inventory[this.selectedInventoryIndex] = null;
    this.updateInventory();
    document.body.removeChild(overlay);
  };

  document.getElementById("confirm-delete-no").onclick = () => {
    document.body.removeChild(overlay);
  };
}

  updateInventory() {
  this.inventory.innerHTML = "";
  
  for (let i = 0; i < this.inventorySlots; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.style.left = "0px";
    slot.style.top = i * this.tileSize * 2 + "px";
    
    // Выделение выбранного слота
    if (i === this.selectedInventoryIndex) {
      slot.style.border = "2px solid green";
    }
    
    // Отображение предметов
    if (this.inventory[i]) {
      if (this.inventory[i].type === "potion") {
        slot.classList.add("potion");
        const potionIcon = document.createElement("div");
        potionIcon.className = "potion-icon";
        potionIcon.textContent = "♥";
        potionIcon.style.cssText = `
          color: red;
          font-size: 20px;
          text-align: center;
          line-height: ${this.tileSize * 2}px;
        `;
        slot.appendChild(potionIcon);
      }
    }
    
    // Отображение мечей (старая система)
    if (i < this.hero.swords) {
      slot.classList.add("sword");
    }
    
    this.inventory.appendChild(slot);
  }
}

  // ============================================================================
  // =========================== ДВИЖЕНИЕ ВРАГОВ ================================
  // ============================================================================

  startEnemyMovement() {
    this.enemyInterval = setInterval(() => {
      if (document.getElementById("victory-overlay")) {
        clearInterval(this.enemyInterval);
        return;
      }

      // Движение врагов
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

      // Движение босса
      if (this.currentLevel === 3 && this.boss) {
        const directions = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
        ];
        const dir = directions[Math.floor(Math.random() * 4)];
        const newX = this.boss.x + dir.dx;
        const newY = this.boss.y + dir.dy;

        if (
          newX >= 0 &&
          newX < this.mapWidth &&
          newY >= 0 &&
          newY < this.mapHeight &&
          this.map[newY][newX] === "." &&
          !(newX === this.hero.x && newY === this.hero.y)
        ) {
          this.map[this.boss.y][this.boss.x] = ".";
          this.boss.x = newX;
          this.boss.y = newY;
          this.map[newY][newX] = "P";
        }
      }

      this.enemyAttack();
      this.renderMap();
    }, 1000);
  }

  // ============================================================================
  // =========================== ПЕРЕХОД УРОВНЕЙ ================================
  // ============================================================================

  startNextLevel() {
    if (this.enemyInterval) {
      clearInterval(this.enemyInterval);
      this.enemyInterval = null;
    }

    this.currentLevel++;
    this.stopMusic();

    if (this.currentLevel > 3) {
      this.showFinalVictory();
      return;
    }

    this.enemies = [];
    this.swords = [];
    this.potions = [];

    this.generateMap();
    this.renderMap();
    this.bindKeys();
    this.startEnemyMovement();
    this.playMusic("fight");
  }
}

var game = new Game();
game.init();
