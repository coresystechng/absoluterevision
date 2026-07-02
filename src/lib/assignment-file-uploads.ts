import { uploadAssignmentFile } from "@/api/assignment-files"
import type { AssignmentFileUpload } from "@/types"

export async function uploadAssignmentFileSelection(input: {
  userId: string
  actorName: string
  assignmentId: number
  files: AssignmentFileUpload[]
}) {
  let uploaded = 0
  let failed = 0

  for (const item of input.files) {
    try {
      await uploadAssignmentFile(input.userId, {
        assignmentId: input.assignmentId,
        actorName: input.actorName,
        file: item.file,
        category: item.category,
      })
      uploaded += 1
    } catch (error) {
      console.error("Failed to upload assignment file", error)
      failed += 1
    }
  }

  return { uploaded, failed }
}
