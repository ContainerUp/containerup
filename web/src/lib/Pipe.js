class Pipe {
    constructor() {
        this._writer = data => {
            setTimeout(() => {
                if (this.cb) {
                    this.cb(data);
                }
            });
        };

        this._onReceive = func => {
            this.cb = func;
        };
    }

    useWriter() {
        return this._writer;
    }

    useOnReceive() {
        return this._onReceive;
    }
}

export default Pipe;
