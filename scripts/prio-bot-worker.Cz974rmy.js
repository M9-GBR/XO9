addEventListener("message", ev => {
    let prioBot = new PrioBot,
        { game, steps } = ev.data,
        [sqr, cell] = prioBot.getPlayCell(game, steps)

    postMessage([sqr, cell])
})

const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
]

class PrioBot {
    name = "prio-bot"
    type = "bot"

    play(game) {
        let [sqr, cell] = this.getPlayCell(game, 3)
        game.playAt(sqr, cell)
    }

    getPlayCell(game, steps) {
        let prioArr = [...this.getPriorityArr(new GameObj(game), game.curPlayer, steps)].sort((a, b) => b.priority - a.priority),
            maxValsPrioArr = prioArr.filter((o, _, arr) => o.priority == arr[0].priority),
            randCell = maxValsPrioArr[Math.floor(Math.random() * maxValsPrioArr.length)],
            [sqr, cell] = randCell.id.split("").map(s => +s)

        return [sqr, cell]
    }

    /** @param {GameObj} gameObj */
    getPriorityArr(gameObj, playerID, steps) {
        steps--

        let cellObjs = gameObj.squares.map((sqr, sI) => sqr.map((_, cI) => ({ id: sI + "" + cI, priority: 0 }))).flat()
            .filter(c => {
                let [sqr, cell] = c.id.split("").map(s => +s)
                return !gameObj.finished && (gameObj.curSquare == 9 || sqr == gameObj.curSquare) && !gameObj.squares[sqr].captured && !gameObj.squares[sqr][cell]
            })

        for (const cell of cellObjs) {
            let [sqrI, cellI] = cell.id.split("").map(s => +s),
                newPriority = this.getPriority(sqrI, cellI, gameObj, playerID != gameObj.curPlayer)

            cell.priority += newPriority

            let newGameObj = gameObj.getCopy()
            newGameObj.playAt(sqrI, cellI)

            if (steps > 0 && !newGameObj.finished) {
                let prioArr = this.getPriorityArr(newGameObj, playerID, steps).map(c => c.priority).sort((a, b) => a - b)
                cell.priority += prioArr[playerID == newGameObj.curPlayer ? prioArr.length - 1 : 0]
            } else {
                cell.priority += (newPriority * steps)
            }
        }

        return cellObjs
    }

    /**
     * @param {number} sqr 
     * @param {number} cell 
     * @param {GameObj} gameObj 
     * @param {boolean} inv 
     */
    getPriority(sqr, cell, gameObj, inv) {
        let priority = 0, playedSqr = gameObj.squares[sqr],
            curPlayer = gameObj.curPlayer,
            getPrioScore = val => val * (inv ? -1 : 1),
            testGame = gameObj.getCopy(), curDCC = gameObj.drawCrossCount

        testGame.playAt(sqr, cell)

        if (testGame.drawCrossCount != curDCC) {
            let oppDiff = gameObj.squares.filter(s => s.captured != curPlayer && s.captured).length - testGame.squares.filter(s => s.captured != curPlayer && s.captured).length,
                youDiff = gameObj.squares.filter(s => s.captured == curPlayer).length - testGame.squares.filter(s => s.captured == curPlayer).length

            priority += getPrioScore(oppDiff * 9)
            priority += getPrioScore(youDiff * -9)
        } else {
            for (const pattern of winPatterns) {
                if (pattern.includes(cell)) {
                    let oppCount = 0, youCount = 0

                    for (let i of pattern) {
                        if (i != cell) {
                            if (playedSqr[i] == curPlayer) youCount++
                            else if (playedSqr[i] != curPlayer && playedSqr[i]) oppCount++
                        }
                    }

                    if (oppCount == 2) {
                        priority += getPrioScore(3)
                    } else if (youCount == 1 && oppCount == 0) {
                        priority += getPrioScore(1)
                    } else if (youCount == 2) {
                        priority += getPrioScore(9)

                        let gameCopy = gameObj.getCopy()
                        gameCopy.playAt(sqr, cell)

                        if (gameCopy.finished) {
                            let winObj = gameCopy.winStatus, finVal = 180

                            if (winObj.type == "main") priority += getPrioScore(finVal)
                            else priority += getPrioScore(finVal * (winObj.value == curPlayer ? 1 : -1))
                        }
                    }
                }
            }
        }

        return priority
    }
}

class GameObj {
    squares = new Array(9).fill().map(() => new GameSquare)
    drawCrossCount = 0
    curPlayer = 1
    curSquare = 4

    get winStatus() {
        let winObj = { type: "", value: 0 }

        for (const pattern of winPatterns) {
            if (pattern.every(v => this.squares[v].captured && this.squares[v].captured == this.squares[pattern[0]].captured)) {
                winObj.type == "main"
                winObj.value = this.squares[pattern[0]].captured

                return winObj
            }
        }

        let xCount = 0, oCount = 0
        for (const sqr of this.squares) {
            sqr.captured == 1 ? xCount++ : sqr.captured == 2 ? oCount++ : 0
        }

        if (xCount + oCount == 9) {
            winObj.type == "count"
            winObj.value = xCount > oCount ? 1 : 2
            return winObj
        }

        return winObj
    }

    get finished() {
        return this.winStatus.value || this.drawCrossCount == 9
    }

    getCopy() {
        let gameObj = new GameObj()

        gameObj.drawCrossCount = this.drawCrossCount
        gameObj.curPlayer = this.curPlayer
        gameObj.curSquare = this.curSquare
        gameObj.squares.forEach((s, i) => s.update(this.squares[i]))

        return gameObj
    }

    constructor(game) {
        if (game) {
            this.updateFromGame(game)
        }
    }

    playAt(sqr, cell) {
        let curSqr = this.squares[sqr]

        curSqr[cell] = this.curPlayer

        if (curSqr.every(v => v) && !curSqr.captured) {
            curSqr.fill(0)

            if (this.squares[sqr + 3]) this.squares[sqr + 3].fill(0)
            if (this.squares[sqr - 3]) this.squares[sqr - 3].fill(0)

            let row = Math.floor(sqr / 3) * 3
            if ((sqr - 1) >= row && (sqr - 1) <= row + 2) {
                if (this.squares[sqr - 1]) this.squares[sqr - 1].fill(0)
            }

            if ((sqr + 1) >= row && (sqr + 1) <= row + 2) {
                if (this.squares[sqr + 1]) this.squares[sqr + 1].fill(0)
            }

            this.drawCrossCount++
        }

        if (!this.finished) {
            this.curPlayer = this.curPlayer == 1 ? 2 : 1
            this.curSquare = this.squares[cell].captured ? 9 : cell
        }
    }

    updateFromGame(game) {
        this.drawCrossCount = game.drawCrossCount
        this.curPlayer = game.curPlayer
        this.curSquare = game.curSquare
        this.squares.forEach((s, i) => s.update(game.squares[i].cells))
    }
}

class GameSquare extends Array {
    overrideCapture = false
    overrideCaptureValue = 0

    get captured() {
        if (!this.overrideCapture) {
            let value = 0

            for (const pattern of winPatterns) {
                if (pattern.every(v => this[v] && this[v] == this[pattern[0]])) {
                    value = this[pattern[0]]
                    break
                }
            }

            return value
        } else return this.overrideCaptureValue
    }

    constructor() {
        super()
        this.push(...new Array(9).fill(0))
    }

    update(arr) {
        this.splice(0, 9, ...arr)
        return this
    }
}