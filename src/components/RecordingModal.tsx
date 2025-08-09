import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Square } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (result: { items: any[] }) => void;
}

const RecordingModal = ({ isOpen, onClose, onRecordingComplete }: RecordingModalProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        variant: "destructive",
        title: "Recording Error",
        description: "Unable to access microphone. Please check your permissions."
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

const processAudio = async (audioBlob: Blob) => {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    const { data: { session } } = await supabase.auth.getSession();

    const resp = await fetch('https://flrnybizzmjhsdmyyiez.supabase.co/functions/v1/transcribe-and-analyze', {
      method: 'POST',
      headers: {
        Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
        apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZscm55Yml6em1qaHNkbXl5aWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MzU3NjIsImV4cCI6MjA2OTMxMTc2Mn0.aVaSG1X2N33iWQbUM6ZbXtgzn38A01xDFYFfbRpIqsI',
      },
      body: formData,
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || 'Edge function error');
    }

    const result = await resp.json();
    if (!result || !Array.isArray(result.items)) {
      throw new Error('Invalid response from transcription service');
    }

    onRecordingComplete(result);
    setIsProcessing(false);
    onClose();
  } catch (error) {
    console.error('Error processing audio:', error);
    toast({
      variant: 'destructive',
      title: 'Processing Error',
      description: 'Unable to process your recording. Please try again.',
    });
    setIsProcessing(false);
  }
};

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm w-[92vw] sm:max-w-md pb-[env(safe-area-inset-bottom)]">
        <DialogHeader>
          <DialogTitle className="text-butler-heading text-center">
            At Your Leisure
          </DialogTitle>
          <DialogDescription className="text-center text-butler-body">
            Please describe your meal, and I shall transcribe it with utmost care.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-6">
          {isProcessing ? (
            <>
              <div className="w-28 h-28 sm:w-24 sm:h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
              <p className="text-muted-foreground text-center">
                Processing your statement...
              </p>
            </>
          ) : (
            <>
              <div 
                className={`w-28 h-28 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isRecording 
                    ? 'bg-destructive recording-pulse' 
                    : 'bg-primary hover:bg-primary/90 hover-elevate cursor-pointer'
                }`}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? (
                  <Square className="w-8 h-8 text-destructive-foreground" />
                ) : (
                  <Mic className="w-8 h-8 text-primary-foreground" />
                )}
              </div>
              
              <div className="text-center">
                <p className="font-medium text-butler-body">
                  {isRecording ? "Recording in progress..." : "Tap to begin recording"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isRecording ? "Tap the square to finish" : "Speak clearly and naturally"}
                </p>
              </div>
              
              {!isRecording && (
                <Button variant="outline" onClick={handleClose} className="mt-4">
                  Perhaps another time
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecordingModal;