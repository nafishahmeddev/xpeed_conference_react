import {
    IoEllipsisVerticalOutline,
    IoMicOffOutline,
    IoMicOutline,
    IoPersonOutline,
    IoVideocamOffOutline,
    IoVideocamOutline
} from "react-icons/all";
import React, {useEffect, useRef, useState} from "react";

import hark from "hark";

export default function UserThumb({stream, video_muted, audio_muted, name, self=false, onPinVideo=()=>{}}, props) {
    const video_ref = useRef();
    const [speaking, setSpeaking] = useState(false);
    useEffect(()=>{
        if(stream && video_ref.current) {
            video_ref.current.srcObject = stream;
            video_ref.current.play();
            video_ref.current.muted = self;

            if(!self) {
                var options = {};
                var speechEvents = hark(stream, options);

                speechEvents.on('speaking', function () {
                    setSpeaking(true);
                });
                speechEvents.on('stopped_speaking', function () {
                    setSpeaking(false);
                });
            }
        }

        if(!self){
            console.log(stream);
        }
    },[stream]);

    useEffect(()=>{
        if(speaking){
            onPinVideo({stream, video_muted, audio_muted, name, self});
        }
    }, [speaking]);

    useEffect(()=>{
        return () => {
            setSpeaking(null); // This worked for me
        };
    },[]);


    return <div onClick={e=>!self?onPinVideo({stream, video_muted, audio_muted, name, self}):()=>{}}
                className={`${speaking?"speaking":""} user-thumb`}>
        <header>
            <button>
                {video_muted?<IoVideocamOffOutline size={14} color="red"/>:<IoVideocamOutline size={14}/>}
            </button>
            <button>
                {audio_muted?<IoMicOffOutline color="red" size={14}/>:<IoMicOutline size={14}/>}
            </button>
            <div></div>
            {
                !self&&<button style={{alignSelf:'flex-end'}}>
                    <IoEllipsisVerticalOutline size={14}/>
                </button>
            }
        </header>

        <footer>
            <span className="name">
                {name} {self && "(me)"}
            </span>
        </footer>

        <video ref={video_ref}/>
        <audio/>


    </div>
}
