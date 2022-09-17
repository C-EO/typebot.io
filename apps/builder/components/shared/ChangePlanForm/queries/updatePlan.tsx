import { loadStripe } from '@stripe/stripe-js/pure'
import { Plan, User } from 'db'
import { env, isDefined, isEmpty, sendRequest } from 'utils'
import { guessIfUserIsEuropean } from '../helpers'

type UpgradeProps = {
  user: User
  stripeId?: string
  plan: Plan
  workspaceId: string
  additionalChats: number
  additionalStorage: number
}

export const pay = async ({
  stripeId,
  ...props
}: UpgradeProps): Promise<{ newPlan: Plan } | undefined | void> =>
  isDefined(stripeId)
    ? updatePlan({ ...props, stripeId })
    : redirectToCheckout(props)

export const updatePlan = async ({
  stripeId,
  plan,
  workspaceId,
  additionalChats,
  additionalStorage,
}: Omit<UpgradeProps, 'user'>): Promise<{ newPlan: Plan } | undefined> => {
  const { data, error } = await sendRequest<{ message: string }>({
    method: 'PUT',
    url: '/api/stripe/subscription',
    body: { workspaceId, plan, stripeId, additionalChats, additionalStorage },
  })
  if (error || !data) return
  return { newPlan: plan }
}

export const redirectToCheckout = async ({
  user,
  plan,
  workspaceId,
  additionalChats,
  additionalStorage,
}: Omit<UpgradeProps, 'customerId'>) => {
  if (isEmpty(env('STRIPE_PUBLIC_KEY')))
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLIC_KEY is missing in env')
  const { data, error } = await sendRequest<{ sessionId: string }>({
    method: 'POST',
    url: '/api/stripe/subscription',
    body: {
      email: user.email,
      currency: guessIfUserIsEuropean() ? 'eur' : 'usd',
      plan,
      workspaceId,
      href: location.origin + location.pathname,
      additionalChats,
      additionalStorage,
    },
  })
  if (error || !data) return
  const stripe = await loadStripe(env('STRIPE_PUBLIC_KEY') as string)
  await stripe?.redirectToCheckout({
    sessionId: data?.sessionId,
  })
}