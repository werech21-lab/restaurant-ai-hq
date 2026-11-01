'use server'

import { revalidatePath } from 'next/cache'
import * as recipes from '@/services/recipe.service'

export async function saveRecipeAction(
  input: Parameters<typeof recipes.saveRecipe>[0],
) {
  const result = await recipes.saveRecipe(input)
  if (result.ok) revalidatePath('/recipes')
  return result
}

export async function deleteRecipeAction(id: string) {
  const result = await recipes.deleteRecipe(id)
  if (result.ok) revalidatePath('/recipes')
  return result
}
