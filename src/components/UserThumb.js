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
            video_ref.current.muted = true;

            var options = {};
            var speechEvents = hark(stream, options);

            speechEvents.on('speaking', function() {
                setSpeaking(true);
            });
            speechEvents.on('stopped_speaking', function() {
                setSpeaking(false);
            });
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
    },[])
    return <div onClick={e=>onPinVideo({stream, video_muted, audio_muted, name, self})} className={`${speaking?"speaking":""}`}>
        <header>
            <button>
                {video_muted?<IoVideocamOffOutline size={16} color="red"/>:<IoVideocamOutline size={16}/>}
            </button>
            <div></div>
            {
                !self&&<button style={{alignSelf:'flex-end'}}>
                    <IoEllipsisVerticalOutline size={16}/>
                </button>
            }
        </header>

        <footer>
            <button>
                {audio_muted?<IoMicOffOutline color="red" size={16}/>:<IoMicOutline size={16}/>}
            </button>
            <span className="name">
                {name} {self && "(me)"}
            </span>
        </footer>

        <video ref={video_ref}/>
        <audio/>


    </div>
}
