import { UserStatus } from "@/lib/api";

interface DailyCounterProps {
  userStatus?: UserStatus;
  isLoading?: boolean;
}

export function DailyCounter({ userStatus, isLoading = false }: DailyCounterProps) {
  // Default values
  const questionsUsed = userStatus?.questionsUsed ?? 0;
  const maxDailyQuestions = userStatus?.maxDailyQuestions ?? 20;
  const questionsRemaining = userStatus?.questionsRemaining ?? maxDailyQuestions;
  const percentUsed = (questionsUsed / maxDailyQuestions) * 100;

  return (
    <div className="p-5 border-b border-neutral-100">
      <p className="text-sm font-medium text-neutral-700">Questions restantes aujourd'hui</p>

      {isLoading ? (
        <div className="flex justify-center mt-4">
          <div className="w-6 h-6 border-t-2 border-primary border-solid rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="mt-2">
          <div className="relative pt-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block text-primary">
                  {questionsUsed}
                </span>
                <span className="text-xs font-semibold inline-block text-neutral-500">
                  /{maxDailyQuestions} questions utilisées
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-neutral-700">
                  {questionsRemaining} restantes
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-2 mt-1 text-xs flex rounded bg-neutral-200">
              <div 
                style={{ width: `${percentUsed}%` }} 
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"
              ></div>
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-500">Réinitialisation à minuit</p>
        </div>
      )}
    </div>
  );
}