import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import useSWR, { SWRConfig } from 'swr'
import { afterEach, expect, it, vi } from 'vitest'
import { ErrorAlert } from '@/components/shared/ErrorAlert'

afterEach(cleanup)

it('retries without passing a click event as replacement SWR data', () => {
  const retry = vi.fn()
  render(<ErrorAlert onRetry={retry} />)
  fireEvent.click(screen.getByRole('button', { name: 'Opnieuw proberen' }))
  expect(retry).toHaveBeenCalledExactlyOnceWith()
})

it('recovers real SWR data after a failed request instead of crashing the page', async () => {
  const fetcher = vi.fn()
    .mockRejectedValueOnce(new Error('Temporary API failure'))
    .mockResolvedValue({days:['Tuesday']})
  function Page() {
    const {data,error,mutate} = useSWR<{days:string[]}>('retry-integration',fetcher,{shouldRetryOnError:false})
    if (error && !data) return <ErrorAlert onRetry={mutate} />
    return <div>{data?.days.map(day => <span key={day}>{day}</span>)}</div>
  }
  render(<SWRConfig value={{provider:() => new Map()}}><Page /></SWRConfig>)
  fireEvent.click(await screen.findByRole('button',{name:'Opnieuw proberen'}))
  expect(await screen.findByText('Tuesday')).toBeVisible()
  expect(screen.queryByRole('button',{name:'Opnieuw proberen'})).toBeNull()
})
