import React from "react"

interface MCQSolutionProps {
  question: string
  options: string[]
  correctOptions: string[]
  questionType: "single_correct" | "multiple_correct" | "true_false"
  reasoning: string
}

const MCQSolution: React.FC<MCQSolutionProps> = ({
  question,
  options,
  correctOptions,
  questionType,
  reasoning
}) => {
  // Helper function to extract option letter from option text
  const getOptionLetter = (option: string): string => {
    const match = option.match(/^([A-Z])[.)]\s/)
    return match ? match[1] : option.charAt(0).toUpperCase()
  }

  return (
    <div className="space-y-4">
      {/* Question Section */}
      <div className="space-y-2">
        <h2 className="text-[13px] font-medium text-white tracking-wide">
          Question
        </h2>
        <div className="bg-black/30 rounded-md p-4 text-[13px] leading-[1.4] text-gray-100">
          {question}
        </div>
      </div>

      {/* Question Type Indicator */}
      <div className="space-y-2">
        <h3 className="text-[13px] font-medium text-white tracking-wide">
          Question Type
        </h3>
        <div className="text-[13px] text-gray-300">
          {questionType === "single_correct" && "Single Correct Answer"}
          {questionType === "multiple_correct" && "Multiple Correct Answers"}
          {questionType === "true_false" && "True/False"}
        </div>
      </div>

      {/* Options Section */}
      <div className="space-y-2">
        <h2 className="text-[13px] font-medium text-white tracking-wide">
          Options
        </h2>
        <div className="space-y-2">
          {options.map((option, index) => {
            const optionLetter = getOptionLetter(option)
            const isCorrect = correctOptions.includes(optionLetter)
            
            return (
              <div
                key={index}
                className={`p-3 rounded-md border text-[13px] leading-[1.4] transition-colors ${
                  isCorrect
                    ? "bg-green-900/50 border-green-600/50 text-green-100"
                    : "bg-black/30 border-gray-600/30 text-gray-100"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5 ${
                      isCorrect
                        ? "bg-green-600 text-white"
                        : "bg-gray-600 text-gray-200"
                    }`}
                  >
                    {optionLetter}
                  </div>
                  <div className="flex-1">
                    {option.replace(/^[A-Z][.)]\s*/, "")}
                  </div>
                  {isCorrect && (
                    <div className="shrink-0">
                      <svg
                        className="w-4 h-4 text-green-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Correct Answer Summary */}
      <div className="space-y-2">
        <h2 className="text-[13px] font-medium text-white tracking-wide">
          Correct Answer{correctOptions.length > 1 ? "s" : ""}
        </h2>
        <div className="bg-green-900/30 border border-green-600/30 rounded-md p-3">
          <div className="text-[13px] text-green-100">
            <strong>{correctOptions.join(", ")}</strong>
            {correctOptions.length > 1 && questionType === "multiple_correct" && (
              <span className="text-green-300 ml-2">(Multiple correct answers)</span>
            )}
          </div>
        </div>
      </div>

      {/* Reasoning Section */}
      <div className="space-y-2">
        <h2 className="text-[13px] font-medium text-white tracking-wide">
          Explanation
        </h2>
        <div className="bg-black/30 rounded-md p-4 text-[13px] leading-[1.4] text-gray-100 whitespace-pre-wrap">
          {reasoning}
        </div>
      </div>

      {/* Helpful Note */}
      <div className="text-[11px] text-gray-400 italic">
        💡 If you're experiencing issues with MCQ processing, try using a different MCQ model in Settings.
      </div>
    </div>
  )
}

export default MCQSolution
