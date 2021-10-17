// useReferredState.js
import React from "react";

export default function useReferredState(initialValue) {
    const [state, setState] = React.useState(initialValue);
    const reference = React.useRef(state);

    const setReferredState = value => {
        reference.current = value;
        setState(value);
    };

    return [reference, setReferredState];
}
