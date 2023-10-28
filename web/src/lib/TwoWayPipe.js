import Pipe from "./Pipe";

class Side {
    constructor(writer, onReceive) {
        this._writer = d => writer(d);
        this._onReceive = f => onReceive(f);
    }

    useWriter() {
        return this._writer;
    }

    useOnReceive() {
        return this._onReceive;
    }
}

class TwoWayPipe {
    constructor() {
        const p1 = new Pipe();
        const p2 = new Pipe();

        this.left = new Side(p1.useWriter(), p2.useOnReceive());
        this.right = new Side(p2.useWriter(), p1.useOnReceive());
    }

    useLeft() {
        return this.left;
    }

    useRight() {
        return this.right;
    }
}

export default TwoWayPipe;

export function getTwoWayPipeSides() {
    const p = new TwoWayPipe();
    return [p.useLeft(), p.useRight()];
}
