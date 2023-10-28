import {getTwoWayPipeSides} from "./TwoWayPipe";

class HostGuestController {
    constructor() {
        const [hostSide, controllerSide] = getTwoWayPipeSides();
        this._hostSide = hostSide;
        this._writeToHost = controllerSide.useWriter();
    }

    asControllerHost() {
        return this._hostSide;
    }

    asControllerGuest(children) {
        this._writeToHost(children);
        return () => this._writeToHost(null);
    }
}

const controllers = {};

export function getController(name) {
    if (controllers[name]) {
        return controllers[name];
    }

    const ctrl = new HostGuestController();
    controllers[name] = ctrl;
    return ctrl;
}

