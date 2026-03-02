'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { MicrophoneIcon, StopIcon, XMarkIcon } from '@heroicons/react/24/outline'

export interface VoiceInputProps {
  onTranscript: (transcript: string) => void
  onError?: (error: string) => void
  language?: string
  continuous?: boolean
  interimResults?: boolean
  className?: string
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  onError,
  language = 'en-US',
  continuous = false,
  interimResults = true,
  className = ''
}) => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // Check if browser supports Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = continuous
      recognition.interimResults = interimResults
      recognition.lang = language

      recognition.onstart = () => {
        setIsListening(true)
        if (navigator.vibrate) {
          navigator.vibrate(10)
        }
      }

      recognition.onresult = (event: any) => {
        let interimText = ''
        let finalText = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalText += transcriptPiece + ' '
          } else {
            interimText += transcriptPiece
          }
        }

        if (finalText) {
          setTranscript(prev => prev + finalText)
          onTranscript(finalText.trim())
        }

        setInterimTranscript(interimText)
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)

        const errorMessages: { [key: string]: string } = {
          'no-speech': 'Nenhuma fala detectada. Tente novamente.',
          'audio-capture': 'Acesso ao microfone negado.',
          'not-allowed': 'Permissão do microfone negada.',
          'network': 'Erro de rede.',
          'aborted': 'Reconhecimento de fala cancelado.'
        }

        const errorMessage = errorMessages[event.error] || 'Ocorreu um erro no reconhecimento de fala.'
        onError?.(errorMessage)
      }

      recognition.onend = () => {
        setIsListening(false)
        setInterimTranscript('')
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [continuous, interimResults, language, onTranscript, onError])

  const startListening = useCallback(async () => {
    if (!isSupported || !recognitionRef.current) {
      onError?.('Reconhecimento de fala não é suportado neste navegador.')
      return
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true })
      recognitionRef.current.start()
    } catch (error) {
      console.error('Microphone access error:', error)
      onError?.('Falha ao acessar o microfone. Verifique as permissões.')
    }
  }, [isSupported, onError])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
  }, [])

  if (!isSupported) {
    return (
      <div className={`p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg ${className}`}>
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          A entrada de voz não é suportada neste navegador.
        </p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col space-y-3 ${className}`}>
      {/* Controls */}
      <div className="flex items-center space-x-2">
        {!isListening ? (
          <button
            onClick={startListening}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-[44px]"
            aria-label="Iniciar entrada de voz"
          >
            <MicrophoneIcon className="w-5 h-5" />
            <span className="font-medium">Iniciar Gravação</span>
          </button>
        ) : (
          <button
            onClick={stopListening}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors animate-pulse min-h-[44px]"
            aria-label="Parar entrada de voz"
          >
            <StopIcon className="w-5 h-5" />
            <span className="font-medium">Parar Gravação</span>
          </button>
        )}

        {transcript && (
          <button
            onClick={clearTranscript}
            className="p-2 text-description hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors min-h-[44px] min-w-[44px]"
            aria-label="Limpar transcrição"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Transcript Display */}
      {(transcript || interimTranscript) && (
        <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <p className="text-sm text-neutral-900 dark:text-neutral-100">
            {transcript}
            <span className="text-icon-muted italic">
              {interimTranscript}
            </span>
          </p>
        </div>
      )}

      {/* Listening Indicator */}
      {isListening && (
        <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
          <div className="flex space-x-1">
            <div className="w-1 h-4 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-1 h-4 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-1 h-4 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="font-medium">Ouvindo...</span>
        </div>
      )}
    </div>
  )
}
