
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const CountdownTimer = () => {
  // Target date: Tuesday, November 11th, 2025 at 14:00 UK time
  const targetDate = new Date('2025-11-11T14:00:00+00:00');

  const calculateTimeLeft = (): TimeLeft => {
    const difference = targetDate.getTime() - new Date().getTime();
    
    if (difference > 0) {
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    }
    
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  };

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="bg-gradient-to-br from-purple-600 via-blue-600 to-purple-700 border-none shadow-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-center text-white text-2xl md:text-3xl">
          <Clock className="h-8 w-8 mr-3 animate-pulse" />
          🚀 Presale Starts In
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3 md:gap-6">
          <div className="bg-white/10 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="text-3xl md:text-5xl font-bold text-white mb-2">{timeLeft.days}</div>
            <div className="text-xs md:text-sm text-purple-100 font-medium">Days</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="text-3xl md:text-5xl font-bold text-white mb-2">{timeLeft.hours}</div>
            <div className="text-xs md:text-sm text-purple-100 font-medium">Hours</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="text-3xl md:text-5xl font-bold text-white mb-2">{timeLeft.minutes}</div>
            <div className="text-xs md:text-sm text-purple-100 font-medium">Minutes</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="text-3xl md:text-5xl font-bold text-white mb-2">{timeLeft.seconds}</div>
            <div className="text-xs md:text-sm text-purple-100 font-medium">Seconds</div>
          </div>
        </div>
        <div className="mt-6 text-center">
          <p className="text-white/90 text-sm md:text-base font-medium">
            Tuesday, November 11th 2025 • 14:00 UK Time
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CountdownTimer;
